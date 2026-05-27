import { AssessmentResult, Profile, Responses, getOpenConstraint, getSystemMappingSummary, stageRecommendations } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { benchmarkingService } from "./benchmarking-service";
import { growthReadinessScoreService } from "./growth-readiness-score";
import { organizationalHealthScoreService } from "./operational-health-score";
import { operationalStrainSpiralClassifier } from "./strain-spiral-classifier";
import { BenchmarkComparison, ExecutiveKpi, ExecutiveKpiGroup, OperationalIntelligenceReport, SupportingMetric } from "./types";
import { band, formatMoney, formatNumber, formatPercent, hasReliableMetric, latestFinancialYear, metric, metricRecord, reliableMetric } from "./scoring-utils";

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
  const findings = keyFindings({ profile, result, responses, enhancedAnalysis, workforceCapacityAnalysis, organizationalHealthScore, growthReadinessScore, operationalStrainSpiral, benchmarks }).slice(0, 5);
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
    supportingMetrics: supportingMetrics(enhancedAnalysis, workforceCapacityAnalysis, responses),
    workforceExtractionDebug: workforceCapacityAnalysis?.careers.debug || null,
    annualReportInsight: annualReportInsight(enhancedAnalysis),
    dataQualityNotes: dataQualityNotes(enhancedAnalysis, workforceCapacityAnalysis)
  };
}

function keyFindings({
  profile,
  result,
  responses,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  organizationalHealthScore,
  growthReadinessScore,
  operationalStrainSpiral,
  benchmarks
}: {
  profile: Profile;
  result: AssessmentResult;
  responses: Responses;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  organizationalHealthScore: ReturnType<typeof organizationalHealthScoreService>;
  growthReadinessScore: ReturnType<typeof growthReadinessScoreService>;
  operationalStrainSpiral: ReturnType<typeof operationalStrainSpiralClassifier>;
  benchmarks: BenchmarkComparison[];
}) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const systemSummary = getSystemMappingSummary(responses);
  const findings = [
    `${profile.organization || "The organization"} is classified as ${operationalStrainSpiral.currentStage} with ${operationalStrainSpiral.stageConfidence}% confidence.`,
    systemSummary ? systemSummary : "",
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
    ...growthReadinessScore.growthConstraints.map(rewriteConstraintAsAction),
    ...operationalStrainSpiral.primaryStrainDrivers.slice(0, 2).map(rewriteDriverAsAction),
    ...stage.actions
  ];
  return [...new Set(priorities.map((priority) => priority.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function supportingMetrics(enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null, responses: Responses): SupportingMetric[] {
  const latest = latestFinancialYear(enhancedAnalysis);
  const systemSummary = getSystemMappingSummary(responses);
  const openConstraint = getOpenConstraint(responses);
  const workflowFriction = Array.isArray(responses["workflow-friction"]) ? responses["workflow-friction"].join(", ") : "";
  return [
    latest?.fiscalYear ? { label: "Latest fiscal year", value: String(latest.fiscalYear), source: latest.sourceNote } : null,
    metric(latest, "totalRevenue") !== null ? { label: "Total revenue", value: formatMoney(metric(latest, "totalRevenue")), source: sourceForMetric(latest, "totalRevenue") } : null,
    metric(latest, "totalExpenses") !== null ? { label: "Total expenses", value: formatMoney(metric(latest, "totalExpenses")), source: sourceForMetric(latest, "totalExpenses") } : null,
    metric(latest, "surplusDeficit") !== null ? { label: "Surplus / deficit", value: formatMoney(metric(latest, "surplusDeficit")), source: sourceForMetric(latest, "surplusDeficit") } : null,
    hasReliableMetric(latest, "monthsCashOnHand") ? { label: "Months cash on hand", value: `${formatNumber(reliableMetric(latest, "monthsCashOnHand"), 1)} months`, source: sourceForMetric(latest, "monthsCashOnHand") } : null,
    hasReliableMetric(latest, "currentRatio") ? { label: "Current ratio", value: formatNumber(reliableMetric(latest, "currentRatio"), 2), source: sourceForMetric(latest, "currentRatio") } : null,
    workforceCapacityAnalysis ? { label: "Open positions", value: String(workforceCapacityAnalysis.metrics.totalOpenPositions), source: "Public careers pages and hiring platforms" } : null,
    workforceCapacityAnalysis?.workforceSize.estimatedEmployeeCount && workforceCapacityAnalysis.workforceSize.confidence !== "low" ? { label: "Estimated headcount", value: String(workforceCapacityAnalysis.workforceSize.estimatedEmployeeCount), source: workforceCapacityAnalysis.workforceSize.sources.join("; ") || "Reliable public source" } : null,
    workforceCapacityAnalysis?.metrics.openRoleRatio !== null && workforceCapacityAnalysis ? { label: "Open position ratio", value: formatPercent(workforceCapacityAnalysis.metrics.openRoleRatio), source: "Public open roles divided by reliable estimated employee count" } : null,
    workforceCapacityAnalysis ? { label: "Leadership openings", value: String(workforceCapacityAnalysis.metrics.leadershipOpenings), source: "Public careers pages and hiring platforms" } : null,
    systemSummary ? { label: "Core system map", value: systemSummary, source: "Assessment response" } : null,
    workflowFriction ? { label: "Major workflow friction", value: workflowFriction, source: "Assessment response" } : null,
    openConstraint ? { label: "Stated operating context", value: openConstraint, source: "Assessment response" } : null,
    enhancedAnalysis?.annualReportAnalysis.score ? { label: "Annual Report Sophistication Score", value: `${enhancedAnalysis.annualReportAnalysis.score.totalScore}/100`, source: enhancedAnalysis.annualReportAnalysis.sourceDocument?.url || "Annual report scan" } : null
  ].filter((item): item is SupportingMetric => Boolean(item));
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
  const barrierText = naturalList([...constraints, ...risks].slice(0, 2));
  const priorityText = naturalList(priorities.slice(0, 3));

  return [
    `${profile.organization || "The organization"} is positioned at ${operationalStrainSpiral.currentStage}: ${operationalStrainSpiral.stageDescription} Organizational Health is ${organizationalHealthScore.totalScore}/100 and Growth Readiness is ${growthReadinessScore.score}/100. Overall resilience appears ${organizationalHealthScore.totalScore >= 70 ? "sound with targeted watch areas" : "constrained but actionable"}, and ${peerText}${strongestBenchmark ? `; strongest peer signal is ${strongestBenchmark.metric}.` : "."}`,
    `The main barriers are ${barrierText || "not fully visible in the available public data"}. Internally, assessment strain is ${result.riskScore}/100, with pressure most visible in ${result.topRiskDomains.map((domain) => domain.shortTitle).join(", ") || "the highest-scoring sections"}.${weakestBenchmark ? ` The weakest benchmark signal is ${weakestBenchmark.metric} at the ${weakestBenchmark.percentile}th percentile.` : ""}`,
    `The clearest improvement path is to ${priorityText ? priorityText.charAt(0).toLowerCase() + priorityText.slice(1) : "focus on the highest-impact operating priorities"} while protecting leadership bandwidth and execution capacity. The opportunity is to convert operational visibility, workflow standardization, and automation readiness into a more scalable operating model.`
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
  const currentRatio = reliableMetric(latest, "currentRatio");
  const monthsCash = reliableMetric(latest, "monthsCashOnHand");
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

  const groups: Array<Omit<ExecutiveKpiGroup, "items"> & { items: Array<ExecutiveKpi | null> }> = [
    {
      title: "Financial Stability KPIs" as const,
      items: [
        hasReliableMetric(latest, "monthsCashOnHand") ? kpi("Months Cash on Hand", `${formatNumber(monthsCash, 1)} months`, indicatorFromHigher(monthsCash, 6, 3), sourceForMetric(latest, "monthsCashOnHand")) : null,
        metric(latest, "totalRevenue") !== null ? kpi("Total Revenue", formatMoney(metric(latest, "totalRevenue")), "watch", sourceForMetric(latest, "totalRevenue")) : null,
        metric(latest, "totalExpenses") !== null ? kpi("Total Expenses", formatMoney(metric(latest, "totalExpenses")), "watch", sourceForMetric(latest, "totalExpenses")) : null,
        metric(latest, "surplusDeficit") !== null ? kpi("Surplus / Deficit", formatMoney(metric(latest, "surplusDeficit")), indicatorFromHigher(metric(latest, "surplusDeficit"), 0, -1), sourceForMetric(latest, "surplusDeficit")) : null,
        kpi("Surplus Margin", formatPercent(surplusMargin), indicatorFromHigher(surplusMargin, 0.03, 0), sourceForMetric(latest, "surplusMargin")),
        kpi("Revenue Growth Rate", formatPercent(revenueGrowth), indicatorFromHigher(revenueGrowth, 0.05, 0), sourceForMetric(latest, "revenueGrowth")),
        hasReliableMetric(latest, "currentRatio") ? kpi("Current Ratio", formatNumber(currentRatio, 2), indicatorFromHigher(currentRatio, 2, 1), sourceForMetric(latest, "currentRatio")) : null,
        revenueConcentration !== null ? kpi("Revenue Concentration", formatPercent(revenueConcentration), indicatorFromLower(revenueConcentration, 0.35, 0.6), sourceForMetric(latest, "revenueConcentration")) : null,
        metric(latest, "programExpenseRatio") !== null ? kpi("Program Expense Ratio", formatPercent(metric(latest, "programExpenseRatio")), indicatorFromHigher(metric(latest, "programExpenseRatio"), 0.75, 0.65), sourceForMetric(latest, "programExpenseRatio")) : null,
        metric(latest, "fundraisingExpenseRatio") !== null ? kpi("Fundraising Expense Ratio", formatPercent(metric(latest, "fundraisingExpenseRatio")), indicatorFromLower(metric(latest, "fundraisingExpenseRatio"), 0.12, 0.2), sourceForMetric(latest, "fundraisingExpenseRatio")) : null,
        metric(latest, "managementGeneralExpenseRatio") !== null ? kpi("Admin / Management Expense Ratio", formatPercent(metric(latest, "managementGeneralExpenseRatio")), indicatorFromLower(metric(latest, "managementGeneralExpenseRatio"), 0.15, 0.25), sourceForMetric(latest, "managementGeneralExpenseRatio")) : null,
        unrestricted !== null ? kpi("Unrestricted Net Assets", formatMoney(unrestricted), indicatorFromHigher(unrestricted, 1, 0), sourceForMetric(latest, "netAssetsWithoutDonorRestrictions")) : null,
        expenses && unrestricted !== null ? kpi("Unrestricted Reserve Ratio", formatPercent(unrestricted / expenses), indicatorFromHigher(unrestricted / expenses, 0.3, 0.1), sourceForMetric(latest, "netAssetsWithoutDonorRestrictions")) : null
      ]
    },
    {
      title: "Operational KPIs" as const,
      items: [
        workforceCapacityAnalysis ? kpi("Open Positions", String(workforceCapacityAnalysis.metrics.totalOpenPositions), indicatorFromLower(workforceCapacityAnalysis.metrics.totalOpenPositions, 2, 8), "Public hiring sources") : null,
        workforceCapacityAnalysis?.workforceSize.estimatedEmployeeCount && workforceCapacityAnalysis.workforceSize.confidence !== "low" ? kpi("Estimated Headcount", String(workforceCapacityAnalysis.workforceSize.estimatedEmployeeCount), "watch", workforceCapacityAnalysis.workforceSize.sources.join("; ")) : null,
        workforceCapacityAnalysis?.metrics.openRoleRatio !== null && workforceCapacityAnalysis ? kpi("Open Position Ratio", formatPercent(workforceCapacityAnalysis.metrics.openRoleRatio), indicatorFromLower(workforceCapacityAnalysis.metrics.openRoleRatio, 0.04, 0.08), "Public hiring sources") : null,
        workforceCapacityAnalysis ? kpi("Leadership Openings", String(workforceCapacityAnalysis.metrics.leadershipOpenings), indicatorFromLower(workforceCapacityAnalysis.metrics.leadershipOpenings, 0.5, 2), "Public hiring sources") : null,
        workforceCapacityAnalysis?.metrics.averageRequisitionAgeDays !== null && workforceCapacityAnalysis ? kpi("Average Requisition Age", `${workforceCapacityAnalysis.metrics.averageRequisitionAgeDays} days`, indicatorFromLower(workforceCapacityAnalysis.metrics.averageRequisitionAgeDays, 30, 60), "Public hiring sources") : null,
        workforceCapacityAnalysis?.metrics.percentOpenMoreThan60Days !== null && workforceCapacityAnalysis ? kpi("Roles Open >60 Days", formatPercent(workforceCapacityAnalysis.metrics.percentOpenMoreThan60Days), indicatorFromLower(workforceCapacityAnalysis.metrics.percentOpenMoreThan60Days, 0.15, 0.35), "Public hiring sources") : null,
        workforceCapacityAnalysis ? kpi("Hiring Concentration by Department", topDepartment(workforceCapacityAnalysis.metrics.openPositionsByDepartment), "watch", "Public hiring sources") : null,
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

  return groups.map((group): ExecutiveKpiGroup => ({
    ...group,
    items: group.items.filter((item): item is ExecutiveKpi => item !== null && item.value !== "Unavailable")
  }));
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

function rewriteConstraintAsAction(constraint: string) {
  if (/systems|integration|technology/i.test(constraint)) return "Prioritize systems integration and reporting consistency.";
  if (/liquidity|cash|reserve|financial/i.test(constraint)) return "Improve financial visibility and reserve planning before adding new operating complexity.";
  if (/process|fragmentation|workflow|knowledge/i.test(constraint)) return "Reduce process fragmentation before adding new program or revenue complexity.";
  if (/staff|hiring|vacanc/i.test(constraint)) return "Resolve critical hiring and role coverage gaps before expanding workload.";
  if (/revenue|concentration/i.test(constraint)) return "Strengthen revenue diversification and renewal visibility.";
  return constraint;
}

function rewriteDriverAsAction(driver: string) {
  if (/systems/i.test(driver)) return "Strengthen system integration, data quality, and reporting ownership.";
  if (/workforce|staff/i.test(driver)) return "Prioritize critical vacancy coverage and workload visibility.";
  if (/financial|liquidity|revenue/i.test(driver)) return "Create a tighter financial operating cadence around revenue, expense, and reserve signals.";
  if (/process|fragmentation/i.test(driver)) return "Standardize high-volume workflows and clarify cross-functional handoffs.";
  return `Stabilize ${driver.split(":")[0].toLowerCase()} before scaling.`;
}

function naturalList(items: string[]) {
  const cleaned = items.map((item) => item.replace(/\.$/, "").trim()).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0].toLowerCase();
  return `${cleaned.slice(0, -1).join(", ").toLowerCase()}, and ${cleaned[cleaned.length - 1].toLowerCase()}`;
}

function topDepartment(departments: Record<string, number>) {
  const top = Object.entries(departments).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} (${top[1]})` : "No concentration detected";
}

function dataQualityNotes(enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null) {
  const latest = latestFinancialYear(enhancedAnalysis);
  const notes: string[] = [];
  if (!hasReliableMetric(latest, "monthsCashOnHand")) notes.push("Months cash on hand was excluded from the main report because cash and average monthly expense data were not available with medium/high confidence.");
  if (!hasReliableMetric(latest, "currentRatio")) notes.push("Current ratio was excluded from the main report because current assets and current liabilities were not available with medium/high confidence.");
  if (!workforceCapacityAnalysis?.workforceSize.estimatedEmployeeCount || workforceCapacityAnalysis.workforceSize.confidence === "low") notes.push("Employee count unavailable from reliable public sources; open position ratio was not calculated.");
  if (workforceCapacityAnalysis && workforceCapacityAnalysis.metrics.averageRequisitionAgeDays === null) notes.push("Job age unavailable because public posting dates were not available from the reviewed hiring sources.");
  if (!enhancedAnalysis?.annualReportAnalysis.sourceDocument) notes.push("annual report not found from public website scan.");
  return notes;
}

function annualReportInsight(enhancedAnalysis: EnhancedAnalysisResult | null) {
  const analysis = enhancedAnalysis?.annualReportAnalysis;
  if (!analysis?.sourceDocument || !analysis.score) {
    return {
      status: "annual report not found from public website scan.",
      score: null,
      findings: [],
      sourceUrl: null
    };
  }

  return {
    status: "Annual report found and analyzed.",
    score: analysis.score.totalScore,
    findings: analysis.score.findings,
    sourceUrl: analysis.sourceDocument.url || null
  };
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
