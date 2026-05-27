import { AssessmentResult } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { BenchmarkComparison, OrganizationalHealthScore, ScoreCategory } from "./types";
import { averageMetric, clampScore, domainHealth, latestFinancialYear, metric, scoreFromThresholds } from "./scoring-utils";

const weights: Record<ScoreCategory, number> = {
  "Financial Stability": 0.25,
  "Workforce Capacity": 0.2,
  "Revenue Operations": 0.2,
  "Governance & Compliance": 0.1,
  "Technology & Systems": 0.1,
  "Strategic Clarity": 0.1,
  "AI/Automation Readiness": 0.05
};

export function organizationalHealthScoreService({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  benchmarks
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  benchmarks: BenchmarkComparison[];
}): OrganizationalHealthScore {
  const latest = latestFinancialYear(enhancedAnalysis);
  const currentRatio = metric(latest, "currentRatio");
  const monthsCash = metric(latest, "monthsCashOnHand");
  const surplusMargin = metric(latest, "surplusMargin");
  const revenueGrowth = averageMetric(enhancedAnalysis?.financialYears, "revenueGrowth");
  const expenseGrowth = averageMetric(enhancedAnalysis?.financialYears, "expenseGrowth");
  const registryRisks = enhancedAnalysis?.registryResults.filter((item) => /delinquent|suspend|not|revoked/i.test(item.status || "")).length || 0;
  const publicRisks = enhancedAnalysis?.publicRecords.filter((item) => ["litigation", "enforcement"].includes(item.signalType)).length || 0;
  const annualReportScore = enhancedAnalysis?.annualReportAnalysis.score?.totalScore ?? null;
  const websiteScore = enhancedAnalysis?.websiteSophistication.score?.totalScore ?? null;

  const categoryScores: OrganizationalHealthScore["categoryScores"] = {
    "Financial Stability": clampScore(
      (scoreFromThresholds(currentRatio, [{ min: 2, score: 95 }, { min: 1.5, score: 80 }, { min: 1, score: 62 }, { min: 0, score: 35 }]) +
        scoreFromThresholds(monthsCash, [{ min: 6, score: 95 }, { min: 3, score: 78 }, { min: 1, score: 55 }, { min: 0, score: 30 }]) +
        scoreFromThresholds(surplusMargin, [{ min: 0.05, score: 92 }, { min: 0, score: 72 }, { min: -0.05, score: 45 }, { min: -1, score: 20 }])) /
        3
    ),
    "Workforce Capacity": workforceCapacityAnalysis ? clampScore(100 - workforceCapacityAnalysis.riskScore.score * 0.75) : domainHealth(result, "staffing"),
    "Revenue Operations": clampScore((domainHealth(result, "visibility") + domainHealth(result, "sustainability") + scoreRevenueTrend(revenueGrowth, expenseGrowth)) / 3),
    "Governance & Compliance": clampScore(90 - registryRisks * 18 - publicRisks * 20),
    "Technology & Systems": domainHealth(result, "systems"),
    "Strategic Clarity": clampScore((domainHealth(result, "sustainability") + strategySignalScore(enhancedAnalysis) + (annualReportScore ?? 50) + (websiteScore ?? 50)) / 4),
    "AI/Automation Readiness": clampScore((domainHealth(result, "systems") + domainHealth(result, "process") + domainHealth(result, "knowledge")) / 3)
  };

  const totalScore = clampScore(Object.entries(categoryScores).reduce((sum, [category, score]) => sum + score * weights[category as ScoreCategory], 0));
  const percentiles = benchmarks.map((item) => item.percentile).filter((value): value is number => value !== null);

  return {
    totalScore,
    categoryScores,
    percentileRanking: percentiles.length ? Math.round(percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length) : null
  };
}

function scoreRevenueTrend(revenueGrowth: number | null, expenseGrowth: number | null) {
  if (revenueGrowth === null && expenseGrowth === null) return 50;
  if (revenueGrowth !== null && expenseGrowth !== null && revenueGrowth >= expenseGrowth && revenueGrowth >= 0) return 86;
  if (revenueGrowth !== null && revenueGrowth >= 0) return 70;
  if (revenueGrowth !== null && revenueGrowth > -0.05) return 48;
  return 30;
}

function strategySignalScore(enhancedAnalysis: EnhancedAnalysisResult | null) {
  const signals = [
    ...(enhancedAnalysis?.websiteAnalysis.strategicPriorities || []),
    ...(enhancedAnalysis?.websiteAnalysis.programExpansionSignals || [])
  ].length;
  if (signals >= 4) return 85;
  if (signals >= 2) return 72;
  if (signals === 1) return 60;
  return 45;
}
