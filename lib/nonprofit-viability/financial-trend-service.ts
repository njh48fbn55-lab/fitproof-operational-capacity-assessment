import { AuditExtraction, FinancialMetric, FinancialMetricName, FinancialYear } from "./types";
import { metricLabel } from "./utils";

const requiredMetrics: FinancialMetricName[] = [
  "totalRevenue",
  "totalExpenses",
  "surplusDeficit",
  "surplusMargin",
  "revenueGrowth",
  "expenseGrowth",
  "cashAndInvestments",
  "currentAssets",
  "currentLiabilities",
  "totalAssets",
  "totalLiabilities",
  "workingCapital",
  "currentRatio",
  "monthsCashOnHand",
  "netAssetsWithoutDonorRestrictions",
  "netAssetsWithDonorRestrictions",
  "debt",
  "fundraisingExpenseRatio",
  "programExpenseRatio",
  "managementGeneralExpenseRatio",
  "revenueConcentration"
];

export function financialTrendService(form990Years: FinancialYear[], auditExtractions: AuditExtraction[] = []) {
  const auditYears = auditExtractions.map(auditToFinancialYear).filter((year): year is FinancialYear => Boolean(year));
  const byYear = new Map<number, FinancialYear>();

  form990Years.forEach((year) => byYear.set(year.fiscalYear, normalizeYear(year)));
  auditYears.forEach((year) => {
    const existing = byYear.get(year.fiscalYear);
    byYear.set(year.fiscalYear, existing ? mergeYears(existing, year) : normalizeYear(year));
  });

  return [...byYear.values()]
    .sort((a, b) => b.fiscalYear - a.fiscalYear)
    .slice(0, 5)
    .map(addDerivedMetrics)
    .map(normalizeYear);
}

function auditToFinancialYear(extraction: AuditExtraction): FinancialYear | null {
  const metrics = Object.values(extraction.fields).filter((metric): metric is FinancialMetric => Boolean(metric));
  if (!metrics.length) return null;
  const fiscalYear = metrics[0].fiscalYear;
  return {
    fiscalYear,
    sourcePriority: 1,
    sourceNote: "Uploaded reports, website financial disclosures, annual reports, and audited statements are preferred over Form 990 when they provide a newer or more detailed value. Conflicts should be reviewed against the source document.",
    metrics
  };
}

function mergeYears(form990: FinancialYear, audit: FinancialYear): FinancialYear {
  const auditMetricNames = new Set(audit.metrics.map((metric) => metric.name));
  return {
    fiscalYear: audit.fiscalYear,
    sourcePriority: 1,
    sourceNote: "Audited financial statement metrics override Form 990 fields where both sources are available.",
    metrics: [
      ...audit.metrics,
      ...form990.metrics
        .filter((metric) => !auditMetricNames.has(metric.name))
        .map((metric) => ({
          ...metric,
          sourceNote: metric.sourceNote || "Form 990 used because audited source did not provide this field."
        }))
    ]
  };
}

function addDerivedMetrics(year: FinancialYear): FinancialYear {
  const currentAssets = getMetric(year, "currentAssets");
  const currentLiabilities = getMetric(year, "currentLiabilities");
  const totalExpenses = getMetric(year, "totalExpenses");
  const cash = getMetric(year, "cashAndInvestments");

  const derived = [
    derivedMetric("workingCapital", currentAssets !== null && currentLiabilities !== null ? currentAssets - currentLiabilities : null, year),
    derivedMetric("currentRatio", currentAssets !== null && currentLiabilities ? currentAssets / currentLiabilities : null, year),
    derivedMetric("monthsCashOnHand", cash !== null && totalExpenses ? cash / (totalExpenses / 12) : null, year)
  ];

  const existing = new Set(year.metrics.map((metric) => metric.name));
  return {
    ...year,
    metrics: [...year.metrics, ...derived.filter((metric) => !existing.has(metric.name))]
  };
}

function normalizeYear(year: FinancialYear): FinancialYear {
  const existing = new Map(year.metrics.map((metric) => [metric.name, metric]));
  return {
    ...year,
    metrics: requiredMetrics.map((name) => existing.get(name) || nullMetric(name, year.fiscalYear, year.sourceNote))
  };
}

function getMetric(year: FinancialYear, name: FinancialMetricName) {
  return year.metrics.find((metric) => metric.name === name)?.value ?? null;
}

function derivedMetric(name: FinancialMetricName, value: number | null, year: FinancialYear): FinancialMetric {
  return {
    name,
    label: metricLabel(name),
    value,
    fiscalYear: year.fiscalYear,
    source: "Derived from available financial metrics",
    confidence: value === null ? "low" : "medium",
    extractionMethod: "990",
    sourceNote: value === null ? "Required source fields were unavailable." : undefined
  };
}

function nullMetric(name: FinancialMetricName, fiscalYear: number, sourceNote: string): FinancialMetric {
  return {
    name,
    label: metricLabel(name),
    value: null,
    fiscalYear,
    source: "Unavailable",
    confidence: "low",
    extractionMethod: "990",
    sourceNote: `No available source provided this field. ${sourceNote}`
  };
}
