import { AssessmentResult } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { GrowthReadinessScore } from "./types";
import { clampScore, domainHealth, latestFinancialYear, metric, scoreFromThresholds } from "./scoring-utils";

export function growthReadinessScoreService({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
}): GrowthReadinessScore {
  const latest = latestFinancialYear(enhancedAnalysis);
  const totalExpenses = metric(latest, "totalExpenses");
  const unrestricted = metric(latest, "netAssetsWithoutDonorRestrictions");
  const scores = {
    liquidity: scoreFromThresholds(metric(latest, "monthsCashOnHand"), [{ min: 6, score: 92 }, { min: 3, score: 76 }, { min: 1, score: 52 }, { min: 0, score: 28 }]),
    unrestrictedCash: unrestricted !== null && totalExpenses ? scoreFromThresholds(unrestricted / totalExpenses, [{ min: 0.4, score: 92 }, { min: 0.2, score: 72 }, { min: 0.08, score: 48 }, { min: 0, score: 25 }]) : 50,
    staffingCapacity: workforceCapacityAnalysis ? clampScore(100 - workforceCapacityAnalysis.riskScore.score) : domainHealth(result, "staffing"),
    leadershipStability: workforceCapacityAnalysis ? clampScore(100 - workforceCapacityAnalysis.metrics.leadershipOpenings * 18) : 60,
    operationalScalability: domainHealth(result, "process"),
    technologyMaturity: domainHealth(result, "systems"),
    revenueDiversification: scoreRevenueConcentration(metric(latest, "revenueConcentration")),
    processFragmentation: domainHealth(result, "knowledge"),
    automationReadiness: clampScore((domainHealth(result, "systems") + domainHealth(result, "process")) / 2)
  };
  const score = clampScore(Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.values(scores).length);
  const growthConstraints = constraints(scores, workforceCapacityAnalysis);
  const scaleEnablers = enablers(scores, enhancedAnalysis);

  return {
    score,
    classification: score >= 82 ? "Growth-ready" : score >= 68 ? "Ready with watch areas" : score >= 50 ? "Constrained" : "Not ready to scale",
    growthConstraints,
    scaleEnablers
  };
}

function scoreRevenueConcentration(value: number | null) {
  if (value === null) return 55;
  if (value <= 0.25) return 90;
  if (value <= 0.45) return 72;
  if (value <= 0.65) return 50;
  return 25;
}

function constraints(scores: Record<string, number>, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null) {
  const labels: Record<string, string> = {
    liquidity: "Liquidity limits near-term flexibility.",
    unrestrictedCash: "Unrestricted reserves appear limited relative to expense base.",
    staffingCapacity: "Public hiring signals suggest possible staffing capacity pressure.",
    leadershipStability: "Open senior roles may create execution risk until coverage is clear.",
    operationalScalability: "Process fragmentation may constrain scale.",
    technologyMaturity: "Systems and integration gaps may slow growth.",
    revenueDiversification: "Revenue concentration may increase growth risk.",
    processFragmentation: "Knowledge infrastructure may not yet support repeatable scaling.",
    automationReadiness: "Automation readiness appears limited by process or systems strain."
  };

  const items = Object.entries(scores)
    .filter(([, score]) => score < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => labels[key])
    .filter(Boolean);

  if (workforceCapacityAnalysis?.riskScore.level === "elevated" || workforceCapacityAnalysis?.riskScore.level === "severe") {
    items.unshift("Hiring pressure should be resolved before adding significant new operating complexity.");
  }

  return [...new Set(items)].slice(0, 5);
}

function enablers(scores: Record<string, number>, enhancedAnalysis: EnhancedAnalysisResult | null) {
  const labels: Record<string, string> = {
    liquidity: "Liquidity position can support controlled investment.",
    staffingCapacity: "Public staffing indicators do not show elevated hiring pressure.",
    operationalScalability: "Processes appear comparatively scalable.",
    technologyMaturity: "Systems foundation can support more automation.",
    automationReadiness: "Automation readiness is strong enough for targeted workflow improvement."
  };

  const items = Object.entries(scores)
    .filter(([, score]) => score >= 75)
    .map(([key]) => labels[key])
    .filter(Boolean);

  if ((enhancedAnalysis?.websiteAnalysis.strategicPriorities.length || 0) > 0) {
    items.push("Public strategy signals provide a basis for prioritizing operational investments.");
  }

  return [...new Set(items)].slice(0, 5);
}
