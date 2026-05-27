import { AssessmentResult } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { GrowthReadinessScore, OrganizationalHealthScore, OperationalStrainSpiralClassification, OperationalStrainSpiralStage } from "./types";
import { averageMetric, domainHealth, latestFinancialYear, metric } from "./scoring-utils";

export function operationalStrainSpiralClassifier({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  organizationalHealthScore,
  growthReadinessScore
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  organizationalHealthScore: OrganizationalHealthScore;
  growthReadinessScore: GrowthReadinessScore;
}): OperationalStrainSpiralClassification {
  const latest = latestFinancialYear(enhancedAnalysis);
  const surplusMargin = metric(latest, "surplusMargin");
  const revenueGrowth = averageMetric(enhancedAnalysis?.financialYears, "revenueGrowth");
  const expenseGrowth = averageMetric(enhancedAnalysis?.financialYears, "expenseGrowth");
  const liquidity = metric(latest, "monthsCashOnHand");
  const reserveStrength = reserveStrengthScore(metric(latest, "netAssetsWithoutDonorRestrictions"), metric(latest, "totalExpenses"));
  const financialPressure = financialPressureScore(surplusMargin, revenueGrowth, expenseGrowth, liquidity, reserveStrength);
  const staffingPressure = workforceCapacityAnalysis ? workforceCapacityAnalysis.riskScore.score : 100 - domainHealth(result, "staffing");
  const fragmentation = (100 - domainHealth(result, "process") + (100 - domainHealth(result, "systems")) + (100 - domainHealth(result, "knowledge"))) / 3;
  const leadershipInstability = workforceCapacityAnalysis ? Math.min(100, workforceCapacityAnalysis.metrics.leadershipOpenings * 25) : 35;
  const systemsMaturityRisk = 100 - domainHealth(result, "systems");
  const processDependencyRisk = 100 - domainHealth(result, "process");
  const compositeRisk = Math.round(
    result.riskScore * 0.2 +
      (100 - organizationalHealthScore.totalScore) * 0.2 +
      (100 - growthReadinessScore.score) * 0.14 +
      financialPressure * 0.16 +
      staffingPressure * 0.12 +
      fragmentation * 0.08 +
      leadershipInstability * 0.04 +
      systemsMaturityRisk * 0.03 +
      processDependencyRisk * 0.03
  );
  const currentStage = stageForRisk(compositeRisk, financialPressure);

  return {
    currentStage,
    stageDescription: stageDescription(currentStage),
    stageConfidence: confidence(enhancedAnalysis, workforceCapacityAnalysis),
    primaryStrainDrivers: primaryDrivers({ result, financialPressure, staffingPressure, fragmentation, leadershipInstability, systemsMaturityRisk, processDependencyRisk }).slice(0, 5),
    likelyFutureRisks: futureRisks({ currentStage, financialPressure, staffingPressure, fragmentation }).slice(0, 5)
  };
}

function stageDescription(stage: OperationalStrainSpiralStage) {
  const descriptions: Record<OperationalStrainSpiralStage, string> = {
    "Stable Foundation": "Operations effectively support mission delivery and growth.",
    "Emerging Complexity": "Growth and program expansion are beginning to pressure internal systems and coordination.",
    "Reactive Scaling": "The organization is growing or evolving faster than operational infrastructure can support efficiently.",
    "Operational Strain": "Teams are compensating for fragmented systems, staffing pressure, and operational bottlenecks.",
    "Capacity Constraint": "Operational limitations are materially affecting execution, scalability, or financial efficiency.",
    "Sustainability Risk": "Structural operational or financial instability threatens long-term resilience."
  };
  return descriptions[stage];
}

function stageForRisk(risk: number, financialPressure: number): OperationalStrainSpiralStage {
  if (risk >= 78 || (risk >= 68 && financialPressure >= 75)) return "Sustainability Risk";
  if (risk >= 66 || financialPressure >= 72) return "Capacity Constraint";
  if (risk >= 52) return "Operational Strain";
  if (risk >= 38) return "Reactive Scaling";
  if (risk >= 22) return "Emerging Complexity";
  return "Stable Foundation";
}

function financialPressureScore(surplusMargin: number | null, revenueGrowth: number | null, expenseGrowth: number | null, monthsCash: number | null, reserveStrength: number) {
  let pressure = 35;
  if (surplusMargin !== null) pressure += surplusMargin < -0.05 ? 25 : surplusMargin < 0 ? 14 : -8;
  if (revenueGrowth !== null && expenseGrowth !== null) pressure += expenseGrowth > revenueGrowth ? 16 : -6;
  if (monthsCash !== null) pressure += monthsCash < 1 ? 25 : monthsCash < 3 ? 14 : monthsCash >= 6 ? -10 : 0;
  pressure += reserveStrength < 35 ? 16 : reserveStrength < 55 ? 8 : reserveStrength >= 80 ? -8 : 0;
  return Math.max(0, Math.min(100, Math.round(pressure)));
}

function reserveStrengthScore(unrestricted: number | null, totalExpenses: number | null) {
  if (unrestricted === null || !totalExpenses) return 50;
  const ratio = unrestricted / totalExpenses;
  if (ratio >= 0.5) return 90;
  if (ratio >= 0.25) return 72;
  if (ratio >= 0.1) return 48;
  return 25;
}

function confidence(enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null) {
  let score = 50;
  if ((enhancedAnalysis?.financialYears.length || 0) >= 3) score += 18;
  if ((enhancedAnalysis?.sources.length || 0) >= 3) score += 10;
  if (workforceCapacityAnalysis) score += 12;
  if (enhancedAnalysis?.organization.ein) score += 10;
  return Math.min(95, score);
}

function primaryDrivers({
  result,
  financialPressure,
  staffingPressure,
  fragmentation,
  leadershipInstability,
  systemsMaturityRisk,
  processDependencyRisk
}: {
  result: AssessmentResult;
  financialPressure: number;
  staffingPressure: number;
  fragmentation: number;
  leadershipInstability: number;
  systemsMaturityRisk: number;
  processDependencyRisk: number;
}) {
  return [
    ...result.topRiskDomains.map((domain) => `${domain.shortTitle}: ${domain.risk}/100 strain in assessment responses.`),
    financialPressure >= 60 ? "Financial pressure: liquidity, surplus, or revenue-expense trend is constraining flexibility." : "",
    staffingPressure >= 45 ? "Workforce capacity: public hiring and/or staffing responses indicate possible capacity pressure." : "",
    fragmentation >= 50 ? "Operational fragmentation: process, knowledge, or system strain may limit scale." : "",
    leadershipInstability >= 50 ? "Leadership stability: senior openings may create decision or execution gaps." : "",
    systemsMaturityRisk >= 50 ? "Systems maturity: integration or data reliability gaps may limit operating visibility." : "",
    processDependencyRisk >= 50 ? "Process dependency: workflow consistency and manual process reliance may limit repeatable execution." : ""
  ].filter(Boolean);
}

function futureRisks({
  currentStage,
  financialPressure,
  staffingPressure,
  fragmentation
}: {
  currentStage: OperationalStrainSpiralStage;
  financialPressure: number;
  staffingPressure: number;
  fragmentation: number;
}) {
  const risks: string[] = [];
  if (financialPressure >= 55) risks.push("Reduced flexibility for investment, hiring, or program expansion.");
  if (staffingPressure >= 45) risks.push("Vacancy or hiring pressure may create execution delays in critical functions.");
  if (fragmentation >= 45) risks.push("Manual workarounds and inconsistent process ownership may compound as demand grows.");
  if (currentStage === "Capacity Constraint" || currentStage === "Sustainability Risk") risks.push("Leadership may need to prioritize stabilization before growth initiatives.");
  if (!risks.length) risks.push("Near-term risks appear manageable if current operating discipline is maintained.");
  return risks;
}
