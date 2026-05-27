import { ConfidenceLevel, FinancialMetric, FinancialYear, NonprofitSearchInput } from "./types";
import { metricLabel, normalizeEin, parseCsv, writeJsonRecord } from "./utils";

type IrsIndexRow = {
  ein: string;
  taxpayerName: string;
  taxPeriod: string;
  filingType: string;
  objectId: string;
  submissionDate: string;
  processingYear: number;
};

const USER_AGENT = "FitProof Nonprofit Viability Analyzer/1.0";

export async function irs990Service(input: NonprofitSearchInput): Promise<FinancialYear[]> {
  const ein = normalizeEin(input.ein);
  if (!ein) return [];

  const filings = await findIrsFilingsByEin(ein);
  const years = (
    await Promise.all(
      filings.slice(0, 5).map(async (filing) => {
        const xml = await fetchIrsXml(filing.objectId);
        return xml ? financialYearFromIrsXml(xml, filing) : null;
      })
    )
  ).filter((year): year is FinancialYear => Boolean(year));

  if (years.length) {
    await writeJsonRecord("irs-990", `${ein}.json`, {
      ein,
      retrievedAt: new Date().toISOString(),
      note: "Normalized from IRS TEOS index CSV records and Form 990 e-file XML where available.",
      years
    }).catch(() => undefined);
  }

  return addGrowthMetrics(years);
}

async function findIrsFilingsByEin(ein: string) {
  const currentYear = new Date().getFullYear();
  const processingYears = Array.from({ length: 8 }, (_, index) => currentYear - index);
  const rows = (
    await Promise.all(processingYears.map((year) => fetchIrsIndexForYear(year).catch(() => [] as IrsIndexRow[])))
  )
    .flat()
    .filter((row) => normalizeEin(row.ein) === ein && row.objectId)
    .sort((a, b) => Number(b.taxPeriod || b.processingYear) - Number(a.taxPeriod || a.processingYear));

  const seenTaxYears = new Set<string>();
  return rows.filter((row) => {
    const taxYear = taxYearFromPeriod(row.taxPeriod) || String(row.processingYear);
    if (seenTaxYears.has(taxYear)) return false;
    seenTaxYears.add(taxYear);
    return true;
  });
}

async function fetchIrsIndexForYear(year: number): Promise<IrsIndexRow[]> {
  const url = `https://apps.irs.gov/pub/epostcard/990/xml/${year}/index_${year}.csv`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return [];

  const records = parseCsv(await response.text());
  return records
    .map((record) => ({
      ein: String(record.ein || ""),
      taxpayerName: String(record.taxpayername || ""),
      taxPeriod: String(record.taxperiod || ""),
      filingType: String(record.filingtype || record.returntype || ""),
      objectId: String(record.objectid || record.objectidnumber || ""),
      submissionDate: String(record.subdate || record.submissiondate || ""),
      processingYear: year
    }))
    .filter((record) => record.ein && record.objectId);
}

async function fetchIrsXml(objectId: string) {
  const urls = [
    `https://s3.amazonaws.com/irs-form-990/${objectId}_public.xml`,
    `https://s3.us-east-1.amazonaws.com/irs-form-990/${objectId}_public.xml`
  ];

  for (const url of urls) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (response?.ok) return response.text();
  }

  return null;
}

function financialYearFromIrsXml(xml: string, filing: IrsIndexRow): FinancialYear {
  const fiscalYear = Number(tagValue(xml, ["TaxYr", "TaxYear"]) || taxYearFromPeriod(filing.taxPeriod) || filing.processingYear);
  const totalRevenue = numberFromTags(xml, ["CYTotalRevenueAmt", "TotalRevenueCurrentYear", "TotalRevenueAmt"]) ?? groupNumber(xml, "TotalRevenueGrp", ["TotalRevenueColumnAmt", "TotalAmt"]);
  const totalExpenses = numberFromTags(xml, ["CYTotalExpensesAmt", "TotalExpensesCurrentYear", "TotalExpensesAmt"]) ?? groupNumber(xml, "TotalFunctionalExpensesGrp", ["TotalAmt"]);
  const surplus = totalRevenue !== null && totalExpenses !== null ? totalRevenue - totalExpenses : numberFromTags(xml, ["RevenueLessExpensesAmt", "RevenueLessExpensesCY"]);
  const cash = sumNullable([
    groupNumber(xml, "CashNonInterestBearingGrp", ["EOYAmt", "EndOfYearAmount"]),
    groupNumber(xml, "SavingsAndTempCashInvstGrp", ["EOYAmt", "EndOfYearAmount"])
  ]);
  const investments = sumNullable([
    groupNumber(xml, "InvestmentsPubTradedSecGrp", ["EOYAmt", "EndOfYearAmount"]),
    groupNumber(xml, "InvestmentsOtherSecuritiesGrp", ["EOYAmt", "EndOfYearAmount"]),
    groupNumber(xml, "InvestmentsProgramRelatedGrp", ["EOYAmt", "EndOfYearAmount"])
  ]);
  const cashAndInvestments = sumNullable([cash, investments]);
  const totalAssets = numberFromTags(xml, ["TotalAssetsEOYAmt", "TotalAssetsEOY"]);
  const totalLiabilities = numberFromTags(xml, ["TotalLiabilitiesEOYAmt", "TotalLiabilitiesEOY"]);
  const netAssets = numberFromTags(xml, ["NetAssetsOrFundBalancesEOYAmt", "NetAssetsOrFundBalancesEOY"]);
  const debt = sumNullable([
    groupNumber(xml, "TaxExemptBondLiabilitiesGrp", ["EOYAmt", "EndOfYearAmount"]),
    groupNumber(xml, "MortgNotesPyblScrdInvstPropGrp", ["EOYAmt", "EndOfYearAmount"]),
    groupNumber(xml, "UnsecuredNotesLoansPayableGrp", ["EOYAmt", "EndOfYearAmount"])
  ]);
  const programExpense = groupNumber(xml, "TotalFunctionalExpensesGrp", ["ProgramServicesAmt"]);
  const managementExpense = groupNumber(xml, "TotalFunctionalExpensesGrp", ["ManagementAndGeneralAmt"]);
  const fundraisingExpense = groupNumber(xml, "TotalFunctionalExpensesGrp", ["FundraisingAmt"]);

  return {
    fiscalYear,
    sourcePriority: 4,
    sourceNote: `IRS TEOS index matched ${filing.taxpayerName || "the organization"} for tax period ${filing.taxPeriod || fiscalYear}; XML object ${filing.objectId}.`,
    metrics: [
      metric("totalRevenue", totalRevenue, fiscalYear, filing),
      metric("totalExpenses", totalExpenses, fiscalYear, filing),
      metric("surplusDeficit", surplus, fiscalYear, filing, "Derived from IRS Form 990 revenue and expenses when direct surplus field was unavailable."),
      metric("surplusMargin", ratio(surplus, totalRevenue), fiscalYear, filing, "Derived from IRS Form 990 revenue and expenses."),
      metric("cashAndInvestments", cashAndInvestments, fiscalYear, filing),
      metric("totalAssets", totalAssets, fiscalYear, filing),
      metric("totalLiabilities", totalLiabilities, fiscalYear, filing),
      metric("netAssetsWithoutDonorRestrictions", netAssets, fiscalYear, filing, "Form 990 does not consistently split net assets by donor restriction; total net assets are used as a standardized proxy."),
      metric("debt", debt, fiscalYear, filing),
      metric("programExpenseRatio", ratio(programExpense, totalExpenses), fiscalYear, filing),
      metric("managementGeneralExpenseRatio", ratio(managementExpense, totalExpenses), fiscalYear, filing),
      metric("fundraisingExpenseRatio", ratio(fundraisingExpense, totalExpenses), fiscalYear, filing)
    ]
  };
}

function metric(name: FinancialMetric["name"], value: number | null, fiscalYear: number, filing: IrsIndexRow, sourceNote?: string): FinancialMetric {
  return {
    name,
    label: metricLabel(name),
    value,
    fiscalYear,
    source: `IRS TEOS Form 990 XML (${filing.objectId})`,
    confidence: value === null ? "low" : ("high" as ConfidenceLevel),
    extractionMethod: "990",
    sourceNote: value === null ? sourceNote || "IRS XML did not provide this field in a recognized structured tag." : sourceNote
  };
}

function tagValue(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<(?:[^:>]+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${name}>`, "i"));
    if (match?.[1]) return match[1].replace(/<[^>]+>/g, "").trim();
  }
  return null;
}

function numberFromTags(xml: string, names: string[]) {
  return numberOrNull(tagValue(xml, names));
}

function groupNumber(xml: string, groupName: string, tagNames: string[]) {
  const group = xml.match(new RegExp(`<(?:[^:>]+:)?${groupName}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${groupName}>`, "i"))?.[1];
  return group ? numberFromTags(group, tagNames) : null;
}

function numberOrNull(value?: string | number | null) {
  if (value === undefined || value === null) return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumNullable(values: (number | null)[]) {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function taxYearFromPeriod(period: string) {
  return period ? period.slice(0, 4) : "";
}

function addGrowthMetrics(years: FinancialYear[]) {
  const sorted = [...years].sort((a, b) => b.fiscalYear - a.fiscalYear);
  return sorted.map((year, index) => {
    const previous = sorted[index + 1];
    const revenue = findMetric(year, "totalRevenue");
    const previousRevenue = previous ? findMetric(previous, "totalRevenue") : null;
    const expenses = findMetric(year, "totalExpenses");
    const previousExpenses = previous ? findMetric(previous, "totalExpenses") : null;

    const filing: IrsIndexRow = {
      ein: "",
      taxpayerName: "",
      taxPeriod: String(year.fiscalYear),
      filingType: "",
      objectId: "derived",
      submissionDate: "",
      processingYear: year.fiscalYear
    };

    return {
      ...year,
      metrics: [
        ...year.metrics,
        metric("revenueGrowth", ratio(revenue !== null && previousRevenue !== null ? revenue - previousRevenue : null, previousRevenue), year.fiscalYear, filing, "Derived from IRS TEOS XML year-over-year revenue data."),
        metric("expenseGrowth", ratio(expenses !== null && previousExpenses !== null ? expenses - previousExpenses : null, previousExpenses), year.fiscalYear, filing, "Derived from IRS TEOS XML year-over-year expense data.")
      ]
    };
  });
}

function findMetric(year: FinancialYear, name: FinancialMetric["name"]) {
  return year.metrics.find((item) => item.name === name)?.value ?? null;
}
