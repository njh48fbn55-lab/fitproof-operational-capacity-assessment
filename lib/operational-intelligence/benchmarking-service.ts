import { AssessmentResult } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { BenchmarkComparison } from "./types";
import { formatNumber, formatPercent, latestFinancialYear, metric } from "./scoring-utils";

type BenchmarkMetric = {
  key: string;
  label: string;
  median: number;
  spread: number;
  higherIsBetter: boolean;
  display: "ratio" | "percent" | "months";
};

const referenceBenchmarks: Record<string, BenchmarkMetric[]> = {
  under_1m: baseBenchmarks({ monthsCash: 2.5, surplusMargin: 0.01, programRatio: 0.72, adminRatio: 0.14, revenueGrowth: 0.03, currentRatio: 1.3, openRoleRatio: 0.08, unrestrictedReserve: 0.12 }),
  "1m_5m": baseBenchmarks({ monthsCash: 3.2, surplusMargin: 0.02, programRatio: 0.74, adminRatio: 0.13, revenueGrowth: 0.04, currentRatio: 1.5, openRoleRatio: 0.07, unrestrictedReserve: 0.16 }),
  "5m_25m": baseBenchmarks({ monthsCash: 4.2, surplusMargin: 0.025, programRatio: 0.76, adminRatio: 0.12, revenueGrowth: 0.045, currentRatio: 1.8, openRoleRatio: 0.055, unrestrictedReserve: 0.22 }),
  "25m_100m": baseBenchmarks({ monthsCash: 4.8, surplusMargin: 0.03, programRatio: 0.78, adminRatio: 0.11, revenueGrowth: 0.04, currentRatio: 2.0, openRoleRatio: 0.045, unrestrictedReserve: 0.26 }),
  over_100m: baseBenchmarks({ monthsCash: 5.5, surplusMargin: 0.025, programRatio: 0.79, adminRatio: 0.1, revenueGrowth: 0.035, currentRatio: 2.1, openRoleRatio: 0.035, unrestrictedReserve: 0.3 })
};

export function benchmarkingService({
  enhancedAnalysis,
  workforceCapacityAnalysis
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
}) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const revenue = metric(latest, "totalRevenue");
  const totalExpenses = metric(latest, "totalExpenses");
  const unrestricted = metric(latest, "netAssetsWithoutDonorRestrictions");
  const band = revenueBand(revenue);
  const group = benchmarkGroup(enhancedAnalysis, revenue, workforceCapacityAnalysis?.workforceSize.estimatedEmployeeCount ?? null);
  const values: Record<string, number | null> = {
    monthsCashOnHand: metric(latest, "monthsCashOnHand"),
    surplusMargin: metric(latest, "surplusMargin"),
    fundraisingEfficiency: metric(latest, "fundraisingExpenseRatio"),
    programExpenseRatio: metric(latest, "programExpenseRatio"),
    adminExpenseRatio: metric(latest, "managementGeneralExpenseRatio"),
    revenueGrowth: metric(latest, "revenueGrowth"),
    liquidityRatio: metric(latest, "currentRatio"),
    openPositionRatio: workforceCapacityAnalysis?.metrics.openRoleRatio ?? null,
    unrestrictedReserveLevels: unrestricted !== null && totalExpenses ? unrestricted / totalExpenses : null
  };

  return referenceBenchmarks[band].map((benchmark) => compareMetric(benchmark, values[benchmark.key], group));
}

function baseBenchmarks(values: {
  monthsCash: number;
  surplusMargin: number;
  programRatio: number;
  adminRatio: number;
  revenueGrowth: number;
  currentRatio: number;
  openRoleRatio: number;
  unrestrictedReserve: number;
}): BenchmarkMetric[] {
  return [
    { key: "monthsCashOnHand", label: "Months cash on hand", median: values.monthsCash, spread: 2, higherIsBetter: true, display: "months" },
    { key: "surplusMargin", label: "Surplus margin", median: values.surplusMargin, spread: 0.06, higherIsBetter: true, display: "percent" },
    { key: "fundraisingEfficiency", label: "Fundraising expense ratio", median: 0.12, spread: 0.08, higherIsBetter: false, display: "percent" },
    { key: "programExpenseRatio", label: "Program expense ratio", median: values.programRatio, spread: 0.1, higherIsBetter: true, display: "percent" },
    { key: "adminExpenseRatio", label: "Admin expense ratio", median: values.adminRatio, spread: 0.07, higherIsBetter: false, display: "percent" },
    { key: "revenueGrowth", label: "Revenue growth", median: values.revenueGrowth, spread: 0.09, higherIsBetter: true, display: "percent" },
    { key: "liquidityRatio", label: "Liquidity ratio", median: values.currentRatio, spread: 0.8, higherIsBetter: true, display: "ratio" },
    { key: "openPositionRatio", label: "Open position ratio", median: values.openRoleRatio, spread: 0.06, higherIsBetter: false, display: "percent" },
    { key: "unrestrictedReserveLevels", label: "Unrestricted reserve level", median: values.unrestrictedReserve, spread: 0.18, higherIsBetter: true, display: "percent" }
  ];
}

function compareMetric(benchmark: BenchmarkMetric, value: number | null, benchmarkGroup: string): BenchmarkComparison {
  const percentile = value === null ? null : approximatePercentile(value, benchmark.median, benchmark.spread, benchmark.higherIsBetter);
  return {
    metric: benchmark.label,
    organizationValue: value,
    organizationDisplay: displayValue(value, benchmark.display),
    peerMedian: benchmark.median,
    peerMedianDisplay: displayValue(benchmark.median, benchmark.display),
    percentile,
    quartile: quartile(percentile),
    benchmarkGroup,
    note: "Directional benchmark based on revenue band and available public metrics; use as an executive screen, not an audited peer study."
  };
}

function revenueBand(revenue: number | null) {
  if (revenue === null) return "5m_25m";
  if (revenue < 1000000) return "under_1m";
  if (revenue < 5000000) return "1m_5m";
  if (revenue < 25000000) return "5m_25m";
  if (revenue < 100000000) return "25m_100m";
  return "over_100m";
}

function benchmarkGroup(enhancedAnalysis: EnhancedAnalysisResult | null, revenue: number | null, employees: number | null) {
  const ntee = enhancedAnalysis?.organization.nteeCode ? `NTEE ${enhancedAnalysis.organization.nteeCode}` : "NTEE unavailable";
  const revenueText = revenue === null ? "revenue unavailable" : revenueBandLabel(revenue);
  const employeeText = employees === null ? "employee size unavailable" : `${employees.toLocaleString()} estimated employees`;
  const state = enhancedAnalysis?.organization.state ? enhancedAnalysis.organization.state : "region unavailable";
  return `${ntee}; ${revenueText}; ${employeeText}; ${state}`;
}

function revenueBandLabel(revenue: number) {
  if (revenue < 1000000) return "under $1M revenue";
  if (revenue < 5000000) return "$1M-$5M revenue";
  if (revenue < 25000000) return "$5M-$25M revenue";
  if (revenue < 100000000) return "$25M-$100M revenue";
  return "$100M+ revenue";
}

function approximatePercentile(value: number, median: number, spread: number, higherIsBetter: boolean) {
  const spreadValue = spread || Math.abs(median) || 1;
  const relative = (value - median) / spreadValue;
  const adjusted = higherIsBetter ? relative : -relative;
  return Math.max(5, Math.min(95, Math.round(50 + adjusted * 20)));
}

function quartile(percentile: number | null): BenchmarkComparison["quartile"] {
  if (percentile === null) return "Unavailable";
  if (percentile >= 75) return "Top quartile";
  if (percentile >= 50) return "Second quartile";
  if (percentile >= 25) return "Third quartile";
  return "Bottom quartile";
}

function displayValue(value: number | null, display: BenchmarkMetric["display"]) {
  if (display === "percent") return formatPercent(value);
  if (display === "months") return value === null ? "Unavailable" : `${formatNumber(value, 1)} months`;
  return value === null ? "Unavailable" : formatNumber(value, 2);
}
