import { careersCrawlerService } from "./careers-crawler-service";
import { organizationalSizeEstimator } from "./organizational-size-estimator";
import { staffingMetricsService } from "./staffing-metrics-service";
import { staffingNarrativeGenerator } from "./staffing-narrative-generator";
import { staffingRiskScoringService } from "./staffing-risk-scoring-service";
import { WorkforceCapacityAnalysis, WorkforceCapacityAnalysisInput } from "./types";

export async function workforceCapacityAnalysisService(input: WorkforceCapacityAnalysisInput): Promise<WorkforceCapacityAnalysis> {
  const careers = await careersCrawlerService({
    organizationName: input.organizationName,
    websiteUrl: input.websiteUrl
  });
  const workforceSize = organizationalSizeEstimator(input.enhancedAnalysis);
  const metrics = staffingMetricsService(careers.roles, workforceSize);
  const riskScore = staffingRiskScoringService(metrics, careers.roles);
  const narrative = staffingNarrativeGenerator({ roles: careers.roles, metrics, workforceSize, riskScore });

  return {
    generatedAt: new Date().toISOString(),
    careers,
    workforceSize,
    metrics,
    riskScore,
    narrative
  };
}
