import { ConfidenceLevel, FinancialYear, NonprofitSearchInput, Organization, SourceDocument } from "./types";
import { formatEin, makeId, metricLabel, normalizeEin, nowIso } from "./utils";

type ProPublicaOrganization = {
  ein?: number | string;
  strein?: string;
  name?: string;
  sub_name?: string;
  city?: string;
  state?: string;
  address?: string;
  ntee_code?: string;
  raw_ntee_code?: string;
  subseccd?: number;
  score?: number;
};

type ProPublicaFiling = Record<string, number | string | null | undefined> & {
  tax_prd_yr?: number;
  tax_prd?: number;
  totrevenue?: number;
  totexpenses?: number;
  totassetsend?: number;
  totliabend?: number;
  netassetsend?: number;
  cashnoninterestbearing?: number;
  svngstempinv?: number;
  invstmntsend?: number;
  current_assets?: number;
  current_liabilities?: number;
  totfuncexpns?: number;
  totprgmrevnue?: number;
  fundraisngfees?: number;
  pdf_url?: string;
  object_id?: string;
};

function confidenceFromScore(score?: number): ConfidenceLevel {
  if ((score || 0) >= 90) return "high";
  if ((score || 0) >= 50) return "medium";
  return "low";
}

export async function searchProPublica(input: NonprofitSearchInput) {
  const ein = normalizeEin(input.ein);
  const url = ein
    ? `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`
    : `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(input.name || "")}${input.state ? `&state%5Bid%5D=${encodeURIComponent(input.state)}` : ""}`;

  const response = await fetch(url, { headers: { "User-Agent": "FitProof Nonprofit Viability Analyzer/1.0" } });
  if (!response.ok) return null;
  return response.json();
}

export async function propublicaService(input: NonprofitSearchInput): Promise<{ sources: SourceDocument[]; financialYears: FinancialYear[] }> {
  const payload = await searchProPublica(input).catch(() => null);
  if (!payload) return { sources: [], financialYears: [] };

  const organization = organizationFromProPublica(payload, input);
  return {
    sources: organization?.sources || [],
    financialYears: financialYearsFromProPublica(payload)
  };
}

export function organizationFromProPublica(payload: any, input: NonprofitSearchInput): Organization | null {
  const org = bestOrganization(payload, input);
  if (!org) return null;
  const ein = normalizeEin(String(org.ein || org.strein || input.ein || ""));
  const name = org.name || org.sub_name || input.name || null;
  const source: SourceDocument = {
    id: makeId("source", `${ein || name}-propublica`),
    title: "ProPublica Nonprofit Explorer",
    url: ein ? `https://projects.propublica.org/nonprofits/organizations/${ein}` : "https://projects.propublica.org/nonprofits/",
    sourceType: "propublica",
    confidence: confidenceFromScore(org.score),
    extractionMethod: "990",
    retrievedAt: nowIso(),
    notes: "ProPublica Nonprofit Explorer API v2 organization match."
  };

  return {
    id: makeId("org", ein || name || "unknown"),
    legalName: name,
    dbaNames: org.sub_name && org.sub_name !== name ? [org.sub_name] : [],
    ein: ein ? formatEin(ein) : null,
    state: org.state || input.state || null,
    address: org.address || [org.city, org.state].filter(Boolean).join(", ") || null,
    website: input.website || null,
    nteeCode: org.ntee_code || org.raw_ntee_code || null,
    exemptionStatus: org.subseccd ? `501(c)(${org.subseccd})` : null,
    sourceConfidence: confidenceFromScore(org.score),
    sources: [source]
  };
}

function bestOrganization(payload: any, input: NonprofitSearchInput): ProPublicaOrganization | undefined {
  if (payload?.organization) return payload.organization as ProPublicaOrganization;
  const organizations = (payload?.organizations || []) as ProPublicaOrganization[];
  if (!organizations.length) return undefined;

  return [...organizations].sort((a, b) => matchScore(b, input) - matchScore(a, input))[0];
}

function matchScore(org: ProPublicaOrganization, input: NonprofitSearchInput) {
  const requestedName = normalizeMatchText(input.name || "");
  const candidateName = normalizeMatchText([org.name, org.sub_name].filter(Boolean).join(" "));
  const requestedTokens = new Set(requestedName.split(" ").filter((token) => token.length > 2));
  const candidateTokens = new Set(candidateName.split(" ").filter((token) => token.length > 2));
  const overlap = [...requestedTokens].filter((token) => candidateTokens.has(token)).length;
  const domainToken = domainNameToken(input.website);

  let score = Number(org.score || 0);
  if (requestedName && candidateName.includes(requestedName)) score += 40;
  score += overlap * 12;
  if (input.state && org.state?.toUpperCase() === input.state.toUpperCase()) score += 25;
  if (domainToken && candidateTokens.has(domainToken)) score += 30;
  return score;
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function domainNameToken(website?: string | null) {
  if (!website) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  } catch {
    return "";
  }
}

export function financialYearsFromProPublica(payload: any): FinancialYear[] {
  const filings = ((payload?.filings_with_data || payload?.filings || []) as ProPublicaFiling[])
    .filter(Boolean)
    .sort((a, b) => Number(b.tax_prd_yr || b.tax_prd || 0) - Number(a.tax_prd_yr || a.tax_prd || 0))
    .slice(0, 5);

  const years = filings.map((filing) => {
    const fiscalYear = Number(filing.tax_prd_yr || String(filing.tax_prd || "").slice(0, 4) || new Date().getFullYear());
    const totalRevenue = numberOrNull(filing.totrevenue);
    const totalExpenses = numberOrNull(filing.totexpenses);
    const surplus = totalRevenue !== null && totalExpenses !== null ? totalRevenue - totalExpenses : null;
    const cashAndInvestments = sumNumbers([filing.cashnoninterestbearing, filing.svngstempinv, filing.invstmntsend]);
    const totalAssets = numberOrNull(filing.totassetsend);
    const totalLiabilities = numberOrNull(filing.totliabend);
    const netAssets = numberOrNull(filing.netassetsend);
    const programRatio = ratio(numberOrNull(filing.totprgmrevnue), totalExpenses);
    const fundraisingRatio = ratio(numberOrNull(filing.fundraisngfees), totalExpenses);

    return {
      fiscalYear,
      sourcePriority: 4,
      sourceNote: "ProPublica Nonprofit Explorer Form 990 summary was used as the standardized baseline.",
      metrics: [
        metric("totalRevenue", totalRevenue, fiscalYear, "ProPublica Nonprofit Explorer", "medium"),
        metric("totalExpenses", totalExpenses, fiscalYear, "ProPublica Nonprofit Explorer", "medium"),
        metric("surplusDeficit", surplus, fiscalYear, "Derived from ProPublica revenue and expenses", "medium"),
        metric("surplusMargin", ratio(surplus, totalRevenue), fiscalYear, "Derived from ProPublica revenue and expenses", "medium"),
        metric("cashAndInvestments", cashAndInvestments, fiscalYear, "ProPublica Nonprofit Explorer", "low"),
        metric("totalAssets", totalAssets, fiscalYear, "ProPublica Nonprofit Explorer", "medium"),
        metric("totalLiabilities", totalLiabilities, fiscalYear, "ProPublica Nonprofit Explorer", "medium"),
        metric("netAssetsWithoutDonorRestrictions", netAssets, fiscalYear, "ProPublica Nonprofit Explorer net assets; donor restriction split unavailable", "low"),
        metric("programExpenseRatio", programRatio, fiscalYear, "Derived from ProPublica functional expense fields when available", "low"),
        metric("fundraisingExpenseRatio", fundraisingRatio, fiscalYear, "Derived from ProPublica functional expense fields when available", "low")
      ]
    } satisfies FinancialYear;
  });

  return addGrowthMetrics(years);
}

function metric(name: FinancialYear["metrics"][number]["name"], value: number | null, fiscalYear: number, source: string, confidence: ConfidenceLevel) {
  return {
    name,
    label: metricLabel(name),
    value,
    fiscalYear,
    source,
    confidence,
    extractionMethod: "990" as const,
    sourceNote: value === null ? "Source did not provide this field." : undefined
  };
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumNumbers(values: unknown[]) {
  const numbers = values.map(numberOrNull).filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function addGrowthMetrics(years: FinancialYear[]) {
  return years.map((year, index) => {
    const previous = years[index + 1];
    const revenue = year.metrics.find((metricItem) => metricItem.name === "totalRevenue")?.value ?? null;
    const previousRevenue = previous?.metrics.find((metricItem) => metricItem.name === "totalRevenue")?.value ?? null;
    const expenses = year.metrics.find((metricItem) => metricItem.name === "totalExpenses")?.value ?? null;
    const previousExpenses = previous?.metrics.find((metricItem) => metricItem.name === "totalExpenses")?.value ?? null;

    return {
      ...year,
      metrics: [
        ...year.metrics,
        metric("revenueGrowth", ratio(revenue !== null && previousRevenue !== null ? revenue - previousRevenue : null, previousRevenue), year.fiscalYear, "Derived from available 990 trend data", "medium"),
        metric("expenseGrowth", ratio(expenses !== null && previousExpenses !== null ? expenses - previousExpenses : null, previousExpenses), year.fiscalYear, "Derived from available 990 trend data", "medium")
      ]
    };
  });
}
