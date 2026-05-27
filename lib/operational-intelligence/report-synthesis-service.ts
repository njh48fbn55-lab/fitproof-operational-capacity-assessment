import { AssessmentResult, Profile, Responses, stageRecommendations } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { benchmarkingService } from "./benchmarking-service";
import { growthReadinessScoreService } from "./growth-readiness-score";
import { organizationalHealthScoreService } from "./operational-health-score";
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
  const organizationalHealthScore = organizationalHealthScoreService({ result, enhancedAnalysis, workforceCapacityAnalysis, benchmarks });
  const growthReadinessScore = growthReadinessScoreService({ result, enhancedAnalysis, workforceCapacityAnalysis });
  const operationalStrainSpiral = operationalStrainSpiralClassifier({ result, enhancedAnalysis, workforceCapacityAnalysis, organizationalHealthScore, growthReadinessScore });
  const benchmarkPercentile = organizationalHealthScore.percentileRanking;
  const findings = keyFindings({ profile, result, enhancedAnalysis, workforceCapacityAnalysis, organizationalHealthScore, growthReadinessScore, operationalStrainSpiral, benchmarks }).slice(0, 5);
  const risks = primaryRisks({ result, enhancedAnalysis, workforceCapacityAnalysis, operationalStrainSpiral }).slice(0, 5);
  const constraints = growthReadinessScore.growthConstraints.slice(0, 5);
  const priorities = recommendedPriorities(result, growthReadinessScore, operationalStrainSpiral).slice(0, 5);

  return {
    executiveSnapshot: {
      operationalStrainScore: result.riskScore,
      organizationalHealthScore: organizationalHealthScore.totalScore,
      growthReadinessScore: growthReadinessScore.score,
      operationalStrainSpiralStage: operationalStrainSpiral.currentStage,
      financialStabilityIndicator: band(organizationalHealthScore.categoryScores["Financial Stability"]),
      workforceCapacityIndicator: band(organizationalHealthScore.categoryScores["Workforce Capacity"]),
      benchmarkPercentile
    },
    executiveSummaryParagraphs: executiveSummaryParagraphs({
      profile,
      result,
      organizationalHealthScore,
      growthReadinessScore,
      operationalStrainSpiral,
      benchmarks,
      risks,
      constraints,
      priorities
    }),
    organizationalHealthScore,
    growthReadinessScore,
    operationalStrainSpiral,
    keyFindings: findings,
    benchmarkHighlights: benchmarkHighlights(benchmarks),
    financialTrend: financialTrend(enhancedAnalysis),
    executiveKpis: executiveKpis({ result, enhancedAnalysis, workforceCapacityAnalysis, organizationalHealthScore, growthReadinessScore, benchmarks }),
    primaryOperationalRisks: risks,
    growthConstraints: constraints,
    recommendedPriorities: priorities,
    supportingMetrics: supportingMetrics(enhancedAnalysis, workforceCapacityAnalysis, responses)
  };
}

function keyFindings({
  profile,
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  organizationalHealthScore,
  growthReadinessScore,
  operationalStrainSpiral,
  benchmarks
}: {
  profile: Profile;
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  organizationalHealthScore: ReturnType<typeof organizationalHealthScoreService>;
  growthReadinessScore: ReturnType<typeof growthReadinessScoreService>;
  operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>;
  benchmarks: BenchmarkComparison[];
}) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const findings = [
    `${profile.organization || "The organization"} is classified as ${operationalStrainSpiral.currentStage} with ${operationalStrainSpiral.stageConfidence}% confidence.`,
    `Organizational Health is ${organizationalHealthScore.totalScore}/100; strongest constraints are ${lowestCategories(organizationalHealthScore.categoryScores).join(" and ")}.`,
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

function executiveSummaryParagraphs({
  profile,
  result,
  organizationalHealthScore,
  growthReadinessScore,
  operationalStrainSpiral,
  benchmarks,
  risks,
  constraints,
  priorities
}: {
  profile: Profile;
  result: AssessmentResult;
  organizationalHealthScore: ReturnType<typeof organizationalHealthScoreService>;
  growthReadinessScore: ReturnType<typeof growthReadinessScoreService>;
  operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>;
  benchmarks: BenchmarkComparison[];
  risks: string[];
  constraints: string[];
  priorities: string[];
}) {
  const percentile = organizationalHealthScore.percentileRanking;
  const peerText = percentile === null ? "peer comparison is limited by available public data" : `benchmark position is approximately the ${percentile}th percentile`;
  const strongestBenchmark = benchmarks.filter((item) => item.percentile !== null).sort((a, b) => (b.percentile || 0) - (a.percentile || 0))[0];
  const weakestBenchmark = benchmarks.filter((item) => item.percentile !== null).sort((a, b) => (a.percentile || 0) - (b.percentile || 0))[0];

  return [
    `${profile.organization || "The organization"} is positioned at ${operationalStrainSpiral.currentStage}: ${operationalStrainSpiral.stageDescription} Organizational Health is ${organizationalHealthScore.totalScore}/100 and Growth Readiness is ${growthReadinessScore.score}/100. Overall resilience appears ${organizationalHealthScore.totalScore >= 70 ? "sound with targeted watch areas" : "constrained but actionable"}, and ${peerText}${strongestBenchmark ? `; strongest peer signal is ${strongestBenchmark.metric}.` : "."}`,
    `The main barriers are ${constraints.slice(0, 2).join(" ") || risks.slice(0, 2).join(" ") || "not fully visible in the available public data"}. Internally, assessment strain is ${result.riskScore}/100, with pressure most visible in ${result.topRiskDomains.map((domain) => domain.shortTitle).join(", ") || "the highest-scoring sections"}.${weakestBenchmark ? ` The weakest benchmark signal is ${weakestBenchmark.metric} at the ${weakestBenchmark.percentile}th percentile.` : ""}`,
    `The improvement path is to focus on ${priorities.slice(0, 2).join(" ") || "the highest-impact operating priorities"} while protecting leadership bandwidth and execution capacity. The opportunity is to convert operational visibility, workflow standardization, and automation readiness into a more scalable operating model.`
  ].map((paragraph) => paragraph.replace(/\s+/g, " ").trim());
}

function financialTrend(enhancedAnalysis: EnhancedAnalysisResult | null) {
  return (enhancedAnalysis?.financialYears || [])
    .slice()
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((year) => ({
      fiscalYear: year.fiscalYear,
      revenue: metric(year, "totalRevenue"),
      expenses: metric(year, "totalExpenses"),
      surplusDeficit: metric(year, "surplusDeficit")
    }));
}

function executiveKpis({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  organizationalHealthScore,
  growthReadinessScore,
  benchmarks
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  organizationalHealthScore: ReturnType<typeof organizationalHealthScoreService>;
  growthReadinessScore: ReturnType<typeof growthReadinessScoreService>;
  benchmarks: BenchmarkComparison[];
}) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const currentRatio = metric(latest, "currentRatio");
  const monthsCash = metric(latest, "monthsCashOnHand");
  const surplusMargin = metric(latest, "surplusMargin");
  const revenueGrowth = metric(latest, "revenueGrowth");
  const revenueConcentration = metric(latest, "revenueConcentration");
  const unrestricted = metric(latest, "netAssetsWithoutDonorRestrictions");
  const expenses = metric(latest, "totalExpenses");
  const systemsRisk = result.domainScores.find((domain) => domain.id === "systems")?.risk ?? null;
  const processRisk = result.domainScores.find((domain) => domain.id === "process")?.risk ?? null;
  const staffingRisk = result.domainScores.find((domain) => domain.id === "staffing")?.risk ?? null;
  const visibilityHealth = organizationalHealthScore.categoryScores["Revenue Operations"];
  const benchmarkPercentile = organizationalHealthScore.percentileRanking;
  const automationIndex = organizationalHealthScore.categoryScores["AI/Automation Readiness"];

  return [
    {
      title: "Financial Stability KPIs" as const,
      items: [
        kpi("Months Cash on Hand", monthsCash === null ? "Unavailable" : `${formatNumber(monthsCash, 1)} months`, indicatorFromHigher(monthsCash, 6, 3), sourceForMetric(latest, "monthsCashOnHand")),
        kpi("Surplus Margin", formatPercent(surplusMargin), indicatorFromHigher(surplusMargin, 0.03, 0), sourceForMetric(latest, "surplusMargin")),
        kpi("Revenue Growth Rate", formatPercent(revenueGrowth), indicatorFromHigher(revenueGrowth, 0.05, 0), sourceForMetric(latest, "revenueGrowth")),
        kpi("Current Ratio", formatNumber(currentRatio, 2), indicatorFromHigher(currentRatio, 2, 1), sourceForMetric(latest, "currentRatio")),
        kpi("Revenue Concentration", formatPercent(revenueConcentration), indicatorFromLower(revenueConcentration, 0.35, 0.6), sourceForMetric(latest, "revenueConcentration")),
        kpi("Unrestricted Reserve Ratio", expenses && unrestricted !== null ? formatPercent(unrestricted / expenses) : "Unavailable", indicatorFromHigher(expenses && unrestricted !== null ? unrestricted / expenses : null, 0.3, 0.1), sourceForMetric(latest, "netAssetsWithoutDonorRestrictions"))
      ]
    },
    {
      title: "Operational KPIs" as const,
      items: [
        kpi("Open Role Ratio", formatPercent(workforceCapacityAnalysis?.metrics.openRoleRatio ?? null), indicatorFromLower(workforceCapacityAnalysis?.metrics.openRoleRatio ?? null, 0.04, 0.08), "Public hiring sources"),
        kpi("Average Requisition Aging", workforceCapacityAnalysis?.metrics.averageRequisitionAgeDays === null || !workforceCapacityAnalysis ? "Unavailable" : `${workforceCapacityAnalysis.metrics.averageRequisitionAgeDays} days`, indicatorFromLower(workforceCapacityAnalysis?.metrics.averageRequisitionAgeDays ?? null, 30, 60), "Public hiring sources"),
        kpi("Systems Fragmentation Score", systemsRisk === null ? "Unavailable" : `${systemsRisk}/100 strain`, indicatorFromLower(systemsRisk, 35, 60), "Assessment response"),
        kpi("Manual Process Dependency", processRisk === null ? "Unavailable" : `${processRisk}/100 strain`, indicatorFromLower(processRisk, 35, 60), "Assessment response"),
        kpi("Staffing Pressure Indicator", staffingRisk === null ? "Unavailable" : `${staffingRisk}/100 strain`, indicatorFromLower(staffingRisk, 35, 60), "Assessment response and public hiring")
      ]
    },
    {
      title: "Growth KPIs" as const,
      items: [
        kpi("Growth Readiness Score", `${growthReadinessScore.score}/100`, indicatorFromHigher(growthReadinessScore.score, 75, 55), "Synthesized score"),
        kpi("Operational Strain Score", `${result.riskScore}/100`, indicatorFromLower(result.riskScore, 35, 60), "Assessment score"),
        kpi("Organizational Health Score", `${organizationalHealthScore.totalScore}/100`, indicatorFromHigher(organizationalHealthScore.totalScore, 75, 55), "Synthesized score"),
        kpi("Peer Benchmark Percentile", benchmarkPercentile === null ? "Unavailable" : `${benchmarkPercentile}th`, indicatorFromHigher(benchmarkPercentile, 65, 40), benchmarks[0]?.benchmarkGroup || "Peer benchmarks"),
        kpi("Automation Opportunity Index", `${automationIndex}/100`, indicatorFromHigher(automationIndex, 75, 55), "Systems, process, and knowledge scores")
      ]
    },
    {
      title: "Governance KPIs" as const,
      items: [
        kpi("Leadership Stability", workforceCapacityAnalysis ? `${workforceCapacityAnalysis.metrics.leadershipOpenings} senior openings` : "Unavailable", indicatorFromLower(workforceCapacityAnalysis?.metrics.leadershipOpenings ?? null, 0.5, 2), "Public hiring sources"),
        kpi("Reporting Maturity", `${Math.round(visibilityHealth)}/100`, indicatorFromHigher(visibilityHealth, 75, 55), "Assessment score"),
        kpi("Strategic Clarity", `${organizationalHealthScore.categoryScores["Strategic Clarity"]}/100`, indicatorFromHigher(organizationalHealthScore.categoryScores["Strategic Clarity"], 75, 55), "Website and assessment signals"),
        kpi("Compliance Risk Indicator", `${organizationalHealthScore.categoryScores["Governance & Compliance"]}/100`, indicatorFromHigher(organizationalHealthScore.categoryScores["Governance & Compliance"], 75, 55), "Public records and registry signals")
      ]
    }
  ];
}

function kpi(label: string, value: string, indicator: "strong" | "watch" | "constrained" | "critical" | "unknown", source: string) {
  return { label, value, indicator, source };
}

function indicatorFromHigher(value: number | null, strong: number, watch: number) {
  if (value === null || Number.isNaN(value)) return "unknown" as const;
  if (value >= strong) return "strong" as const;
  if (value >= watch) return "watch" as const;
  if (value >= watch * 0.6) return "constrained" as const;
  return "critical" as const;
}

function indicatorFromLower(value: number | null, strongMax: number, watchMax: number) {
  if (value === null || Number.isNaN(value)) return "unknown" as const;
  if (value <= strongMax) return "strong" as const;
  if (value <= watchMax) return "watch" as const;
  if (value <= watchMax * 1.5) return "constrained" as const;
  return "critical" as const;
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

function benchmarkHighlights(benchmarks: BenchmarkComparison[]) {
  const available = benchmarks.filter((item) => item.organizationValue !== null);
  const weakest = [...available].sort((a, b) => (a.percentile || 0) - (b.percentile || 0)).slice(0, 3);
  const strongest = [...available].sort((a, b) => (b.percentile || 0) - (a.percentile || 0)).slice(0, 2);
  return [...new Map([...weakest, ...strongest].map((item) => [item.metric, item])).values()].slice(0, 5);
}
