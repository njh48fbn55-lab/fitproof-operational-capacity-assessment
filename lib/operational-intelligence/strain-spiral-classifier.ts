import { AssessmentResult } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";
import { GrowthReadinessScore, OperationalHealthScore, OperationalStrainSpiralClassification, OperationalStrainSpiralStage } from "./types";
import { averageMetric, domainHealth, latestFinancialYear, metric } from "./scoring-utils";

export function operationalStrainSpiralClassifier({
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis,
  operationalHealthScore,
  growthReadinessScore
}: {
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
  operationalHealthScore: OperationalHealthScore;
  growthReadinessScore: GrowthReadinessScore;
}): OperationalStrainSpiralClassification {
  const latest = latestFinancialYear(enhancedAnalysis);
  const surplusMargin = metric(latest, "surplusMargin");
  const revenueGrowth = averageMetric(enhancedAnalysis?.financialYears, "revenueGrowth");
  const expenseGrowth = averageMetric(enhancedAnalysis?.financialYears, "expenseGrowth");
  const financialPressure = financialPressureScore(surplusMargin, revenueGrowth, expenseGrowth, metric(latest, "monthsCashOnHand"));
  const staffingPressure = workforceCapacityAnalysis ? workforceCapacityAnalysis.riskScore.score : 100 - domainHealth(result, "staffing");
  const fragmentation = (100 - domainHealth(result, "process") + (100 - domainHealth(result, "systems")) + (100 - domainHealth(result, "knowledge"))) / 3;
  const compositeRisk = Math.round(result.riskScore * 0.28 + (100 - operationalHealthScore.totalScore) * 0.28 + (100 - growthReadinessScore.score) * 0.18 + financialPressure * 0.16 + staffingPressure * 0.1);
  const currentStage = stageForRisk(compositeRisk, financialPressure);

  return {
    currentStage,
    stageConfidence: confidence(enhancedAnalysis, workforceCapacityAnalysis),
    primaryStrainDrivers: primaryDrivers({ result, financialPressure, staffingPressure, fragmentation }).slice(0, 5),
    likelyFutureRisks: futureRisks({ currentStage, financialPressure, staffingPressure, fragmentation }).slice(0, 5)
  };
}

function stageForRisk(risk: number, financialPressure: number): OperationalStrainSpiralStage {
  if (risk >= 78 || (risk >= 68 && financialPressure >= 75)) return "Critical Capacity Risk";
  if (risk >= 66 || financialPressure >= 72) return "Revenue Instability";
  if (risk >= 52) return "Operational Strain";
  if (risk >= 38) return "Reactive Scaling";
  if (risk >= 22) return "Emerging Complexity";
  return "Stable Foundation";
}

function financialPressureScore(surplusMargin: number | null, revenueGrowth: number | null, expenseGrowth: number | null, monthsCash: number | null) {
  let pressure = 35;
  if (surplusMargin !== null) pressure += surplusMargin < -0.05 ? 25 : surplusMargin < 0 ? 14 : -8;
  if (revenueGrowth !== null && expenseGrowth !== null) pressure += expenseGrowth > revenueGrowth ? 16 : -6;
  if (monthsCash !== null) pressure += monthsCash < 1 ? 25 : monthsCash < 3 ? 14 : monthsCash >= 6 ? -10 : 0;
  return Math.max(0, Math.min(100, Math.round(pressure)));
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
  fragmentation
}: {
  result: AssessmentResult;
  financialPressure: number;
  staffingPressure: number;
  fragmentation: number;
}) {
  return [
    ...result.topRiskDomains.map((domain) => `${domain.shortTitle}: ${domain.risk}/100 strain in assessment responses.`),
    financialPressure >= 60 ? "Financial pressure: liquidity, surplus, or revenue-expense trend is constraining flexibility." : "",
    staffingPressure >= 45 ? "Workforce capacity: public hiring and/or staffing responses indicate possible capacity pressure." : "",
    fragmentation >= 50 ? "Operational fragmentation: process, knowledge, or system strain may limit scale." : ""
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
  if (currentStage === "Revenue Instability" || currentStage === "Critical Capacity Risk") risks.push("Leadership may need to prioritize stabilization before growth initiatives.");
  if (!risks.length) risks.push("Near-term risks appear manageable if current operating discipline is maintained.");
  return risks;
}
