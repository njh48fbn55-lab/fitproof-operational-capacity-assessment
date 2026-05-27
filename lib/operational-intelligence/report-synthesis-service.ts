import { AssessmentResult, Profile, Responses, stageRecommendations } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { benchmarkingService } from "./benchmarking-service";
import { growthReadinessScoreService } from "./growth-readiness-score";
import { operationalHealthScoreService } from "./operational-health-score";
import { operationalStrainSpiralClassifier } from "./strain-spiral-classifier";
import { BenchmarkComparison, OperationalIntelligenceReport, SupportingMetric } from "./types";
import { band, formatMoney, formatNumber, formatPercent, latestFinancialYear, metric } from "./scoring-utils";

export function reportSynthesisService({
  profile,
  result,
  responses,
  enhancedAnalysis,
  workforceCapacityAnalysis
}: {
  profile: Profile;
  result: AssessmentResult;
  responses: Responses;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
}): OperationalIntelligenceReport {
  const benchmarks = benchmarkingService({ result, enhancedAnalysis, workforceCapacityAnalysis });
  const operationalHealthScore = operationalHealthScoreService({ result, enhancedAnalysis, workforceCapacityAnalysis, benchmarks });
  const growthReadinessScore = growthReadinessScoreService({ result, enhancedAnalysis, workforceCapacityAnalysis });
  const operationalStrainSpiral = operationalStrainSpiralClassifier({ result, enhancedAnalysis, workforceCapacityAnalysis, operationalHealthScore, growthReadinessScore });
  const benchmarkPercentile = operationalHealthScore.percentileRanking;

  return {
    executiveSnapshot: {
      operationalHealthScore: operationalHealthScore.totalScore,
      growthReadinessScore: growthReadinessScore.score,
      operationalStrainSpiralStage: operationalStrainSpiral.currentStage,
      financialStabilityIndicator: band(operationalHealthScore.categoryScores["Financial Stability"]),
      workforceCapacityIndicator: band(operationalHealthScore.categoryScores["Workforce Capacity"]),
      benchmarkPercentile
    },
    operationalHealthScore,
    growthReadinessScore,
    operationalStrainSpiral,
    keyFindings: keyFindings({ profile, result, enhancedAnalysis, workforceCapacityAnalysis, operationalHealthScore, growthReadinessScore, operationalStrainSpiral, benchmarks }).slice(0, 5),
    benchmarkHighlights: benchmarks.filter((item) => item.organizationValue !== null).sort((a, b) => (b.percentile || 0) - (a.percentile || 0)).slice(0, 5),
    primaryOperationalRisks: primaryRisks({ result, enhancedAnalysis, workforceCapacityAnalysis, operationalStrainSpiral }).slice(0, 5),
    growthConstraints: growthReadinessScore.growthConstraints.slice(0, 5),
    recommendedPriorities: recommendedPriorities(result, growthReadinessScore, operationalStrainSpiral).slice(0, 5),
    supportingMetrics: supportingMetrics(enhancedAnalysis, workforceCapacityAnalysis, responses)
  };
}

function keyFindings({
  profile,
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  operationalHealthScore,
  growthReadinessScore,
  operationalStrainSpiral,
  benchmarks
}: {
  profile: Profile;
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  operationalHealthScore: ReturnType<typeof operationalHealthScoreService>;
  growthReadinessScore: ReturnType<typeof growthReadinessScoreService>;
  operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>;
  benchmarks: BenchmarkComparison[];
}) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const findings = [
    `${profile.organization || "The organization"} is classified as ${operationalStrainSpiral.currentStage} with ${operationalStrainSpiral.stageConfidence}% confidence.`,
    `Operational Health is ${operationalHealthScore.totalScore}/100; strongest constraints are ${lowestCategories(operationalHealthScore.categoryScores).join(" and ")}.`,
    `Growth Readiness is ${growthReadinessScore.score}/100 (${growthReadinessScore.classification}).`,
    metric(latest, "surplusMargin") !== null ? `Latest surplus margin is ${formatPercent(metric(latest, "surplusMargin"))}.` : "",
    workforceCapacityAnalysis ? `Public hiring signals indicate ${workforceCapacityAnalysis.riskScore.level} workforce capacity pressure.` : "",
    benchmarkSummary(benchmarks),
    `Assessment strain score is ${result.riskScore}/100, led by ${result.topRiskDomains.map((domain) => domain.shortTitle).join(", ")}.`
  ];

  return findings.filter(Boolean);
}

function primaryRisks({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  operationalStrainSpiral
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>;
}) {
  return [
    ...operationalStrainSpiral.primaryStrainDrivers,
    ...(enhancedAnalysis?.viabilityScore.riskFlags || []),
    ...(workforceCapacityAnalysis?.riskScore.evidence || []),
    ...result.flags
  ].filter(Boolean);
}

function recommendedPriorities(result: AssessmentResult, growthReadinessScore: ReturnType<typeof growthReadinessScoreService>, operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>) {
  const stage = stageRecommendations[result.stage.number];
  const priorities = [
    ...growthReadinessScore.growthConstraints.map((constraint) => `Address growth constraint: ${constraint}`),
    ...operationalStrainSpiral.primaryStrainDrivers.slice(0, 2).map((driver) => `Stabilize ${driver.split(":")[0].toLowerCase()} before scaling.`),
    ...stage.actions
  ];
  return [...new Set(priorities)];
}

function supportingMetrics(enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null, responses: Responses): SupportingMetric[] {
  const latest = latestFinancialYear(enhancedAnalysis);
  const metrics: SupportingMetric[] = [
    { label: "Latest fiscal year", value: latest?.fiscalYear ? String(latest.fiscalYear) : "Unavailable", source: latest?.sourceNote || "Public financial source unavailable" },
    { label: "Total revenue", value: formatMoney(metric(latest, "totalRevenue")), source: sourceForMetric(latest, "totalRevenue") },
    { label: "Total expenses", value: formatMoney(metric(latest, "totalExpenses")), source: sourceForMetric(latest, "totalExpenses") },
    { label: "Surplus / deficit", value: formatMoney(metric(latest, "surplusDeficit")), source: sourceForMetric(latest, "surplusDeficit") },
    { label: "Months cash on hand", value: metric(latest, "monthsCashOnHand") === null ? "Unavailable" : `${formatNumber(metric(latest, "monthsCashOnHand"), 1)} months`, source: sourceForMetric(latest, "monthsCashOnHand") },
    { label: "Current ratio", value: formatNumber(metric(latest, "currentRatio"), 2), source: sourceForMetric(latest, "currentRatio") },
    { label: "Open positions", value: workforceCapacityAnalysis ? String(workforceCapacityAnalysis.metrics.totalOpenPositions) : "Unavailable", source: "Public careers pages and hiring platforms" },
    { label: "Open position ratio", value: formatPercent(workforceCapacityAnalysis?.metrics.openRoleRatio ?? null), source: "Public open roles divided by estimated employee count" },
    { label: "Leadership openings", value: workforceCapacityAnalysis ? String(workforceCapacityAnalysis.metrics.leadershipOpenings) : "Unavailable", source: "Public careers pages and hiring platforms" },
    { label: "Stated operating constraint", value: String(responses["biggest-constraint"] || "Unavailable"), source: "Assessment response" }
  ];

  return metrics;
}

function sourceForMetric(year: ReturnType<typeof latestFinancialYear>, metricName: Parameters<typeof metric>[1]) {
  return year?.metrics.find((item) => item.name === metricName)?.source || "Unavailable";
}

function lowestCategories(categoryScores: Record<string, number>) {
  return Object.entries(categoryScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([category]) => category);
}

function benchmarkSummary(benchmarks: BenchmarkComparison[]) {
  const available = benchmarks.filter((item) => item.percentile !== null);
  if (!available.length) return "";
  const weakest = [...available].sort((a, b) => (a.percentile || 0) - (b.percentile || 0))[0];
  return `${weakest.metric} is the weakest benchmark signal at the ${weakest.percentile}th percentile.`;
}
