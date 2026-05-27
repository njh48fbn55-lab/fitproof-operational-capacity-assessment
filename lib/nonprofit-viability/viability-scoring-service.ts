import { FinancialYear, PublicRecordSignal, RegistrySearchResult, ViabilityScore, WebsiteAnalysis } from "./types";

export function viabilityScoringService(financialYears: FinancialYear[], websiteAnalysis?: WebsiteAnalysis, registryResults: RegistrySearchResult[] = [], publicRecords: PublicRecordSignal[] = []): ViabilityScore {
  const latest = financialYears[0];
  const revenueGrowth = averageMetric(financialYears, "revenueGrowth");
  const expenseGrowth = averageMetric(financialYears, "expenseGrowth");
  const surplusMargins = financialYears.map((year) => metric(year, "surplusMargin")).filter((value): value is number => value !== null);
  const currentRatio = latest ? metric(latest, "currentRatio") : null;
  const monthsCash = latest ? metric(latest, "monthsCashOnHand") : null;
  const unrestricted = latest ? metric(latest, "netAssetsWithoutDonorRestrictions") : null;
  const debt = latest ? metric(latest, "debt") : null;
  const totalAssets = latest ? metric(latest, "totalAssets") : null;
  const publicRiskSignals = publicRecords.filter((record) => ["litigation", "enforcement"].includes(record.signalType)).length;
  const complexitySignals = websiteAnalysis?.operationalComplexitySignals.length || 0;

  const categories = {
    liquidity: scoreLiquidity(currentRatio, monthsCash),
    revenueTrend: scorePositiveTrend(revenueGrowth, 15),
    expenseDiscipline: scoreExpenseDiscipline(revenueGrowth, expenseGrowth),
    surplusDeficitTrend: scoreSurplus(surplusMargins),
    netAssetStrength: scoreNetAssets(unrestricted, totalAssets, debt),
    revenueConcentrationRisk: 5,
    complianceGovernanceSignals: Math.max(0, 10 - publicRiskSignals * 3 - registryResults.filter((result) => /not|delinquent|suspended/i.test(result.status || "")).length * 4),
    operationalComplexityStrainSignals: Math.max(0, 5 - Math.min(5, complexitySignals))
  };

  const total = Math.round(Object.values(categories).reduce((sum, value) => sum + value, 0));
  const riskFlags = buildRiskFlags({ currentRatio, monthsCash, revenueGrowth, expenseGrowth, surplusMargins, publicRiskSignals, complexitySignals });

  return {
    total,
    classification: classify(total),
    categories,
    riskFlags
  };
}

function metric(year: FinancialYear, name: string) {
  return year.metrics.find((item) => item.name === name)?.value ?? null;
}

function averageMetric(years: FinancialYear[], name: string) {
  const values = years.map((year) => metric(year, name)).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function scoreLiquidity(currentRatio: number | null, monthsCash: number | null) {
  let score = 8;
  if (currentRatio !== null) score += currentRatio >= 2 ? 6 : currentRatio >= 1 ? 3 : 0;
  if (monthsCash !== null) score += monthsCash >= 6 ? 6 : monthsCash >= 3 ? 4 : monthsCash >= 1 ? 2 : 0;
  return Math.min(20, score);
}

function scorePositiveTrend(value: number | null, max: number) {
  if (value === null) return Math.round(max * 0.45);
  if (value >= 0.05) return max;
  if (value >= 0) return Math.round(max * 0.75);
  if (value >= -0.05) return Math.round(max * 0.45);
  return Math.round(max * 0.2);
}

function scoreExpenseDiscipline(revenueGrowth: number | null, expenseGrowth: number | null) {
  if (expenseGrowth === null) return 7;
  if (revenueGrowth !== null && expenseGrowth <= revenueGrowth) return 15;
  if (expenseGrowth <= 0.03) return 11;
  if (expenseGrowth <= 0.08) return 7;
  return 3;
}

function scoreSurplus(margins: number[]) {
  if (!margins.length) return 7;
  const positiveYears = margins.filter((margin) => margin >= 0).length;
  const average = margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
  if (positiveYears >= 4 && average >= 0.03) return 15;
  if (positiveYears >= 3 && average >= 0) return 11;
  if (positiveYears >= 2) return 7;
  return 3;
}

function scoreNetAssets(unrestricted: number | null, totalAssets: number | null, debt: number | null) {
  if (unrestricted === null && totalAssets === null) return 5;
  const assetBase = totalAssets || unrestricted || 1;
  const unrestrictedRatio = unrestricted !== null ? unrestricted / assetBase : 0.3;
  const debtRatio = debt !== null ? debt / assetBase : 0;
  let score = unrestrictedRatio >= 0.5 ? 8 : unrestrictedRatio >= 0.25 ? 5 : 2;
  if (debtRatio < 0.2) score += 2;
  return Math.min(10, score);
}

function classify(total: number): ViabilityScore["classification"] {
  if (total >= 80) return "Stable / growth-ready";
  if (total >= 65) return "Generally viable with watch areas";
  if (total >= 50) return "Operationally strained";
  if (total >= 35) return "Financially vulnerable";
  return "High viability risk";
}

function buildRiskFlags({
  currentRatio,
  monthsCash,
  revenueGrowth,
  expenseGrowth,
  surplusMargins,
  publicRiskSignals,
  complexitySignals
}: {
  currentRatio: number | null;
  monthsCash: number | null;
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  surplusMargins: number[];
  publicRiskSignals: number;
  complexitySignals: number;
}) {
  const flags: string[] = [];
  if (currentRatio !== null && currentRatio < 1) flags.push("Current ratio below 1.0 indicates near-term liquidity pressure.");
  if (monthsCash !== null && monthsCash < 3) flags.push("Months of cash on hand below three months.");
  if (revenueGrowth !== null && expenseGrowth !== null && expenseGrowth > revenueGrowth) flags.push("Expenses are growing faster than revenue.");
  if (surplusMargins.filter((margin) => margin < 0).length >= 2) flags.push("Multiple deficit years in the available trend period.");
  if (publicRiskSignals > 0) flags.push("Relevant public legal or enforcement signal should be reviewed.");
  if (complexitySignals >= 5) flags.push("Website signals suggest high operating complexity.");
  return flags;
}
