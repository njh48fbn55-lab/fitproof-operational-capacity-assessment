import { nonprofitEnrichmentService } from "@/lib/nonprofit-viability/enrichment-service";
import { workforceCapacityAnalysisService } from "@/lib/workforce-capacity/workforce-capacity-service";
import { getAssessment, getJob, saveJobResults, updateJob, updateJobStep } from "./job-store";
import { buildGeneratedReport } from "./report-builder";

const activeJobs = new Set<string>();

export function enqueueAnalysisJob(jobId: string) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);
  setTimeout(() => {
    void runAnalysisJob(jobId).finally(() => activeJobs.delete(jobId));
  }, 50);
}

export async function retryAnalysisJob(jobId: string) {
  const job = await getJob(jobId);
  await updateJob(jobId, {
    status: "queued",
    currentStep: "queued",
    progressPercent: 0,
    errorMessage: null,
    completedAt: null,
    attempts: job.attempts
  });
  enqueueAnalysisJob(jobId);
}

async function runAnalysisJob(jobId: string) {
  const started = new Date().toISOString();
  let job = await getJob(jobId);
  const assessment = await getAssessment(job.assessmentId);

  try {
    job = await updateJob(jobId, {
      status: "running",
      currentStep: "identifying_organization",
      progressPercent: 8,
      startedAt: job.startedAt || started,
      attempts: job.attempts + 1,
      errorMessage: null
    });
    logStep(jobId, "identifying_organization");

    await updateJobStep(jobId, "fetching_sources", 20);
    logStep(jobId, "fetching_sources");

    const enhancedAnalysis = await nonprofitEnrichmentService({
      name: assessment.profile.organization,
      website: assessment.profile.websiteUrl,
      includePublicRecordsSearch: true,
      includeStateRegistrySearch: true
    });

    await updateJobStep(jobId, "parsing_documents", 42);
    logStep(jobId, "parsing_documents");

    await updateJobStep(jobId, "extracting_financials", 56);
    logStep(jobId, "extracting_financials", {
      financialYears: enhancedAnalysis.financialYears.map((year) => year.fiscalYear)
    });

    await updateJobStep(jobId, "calculating_trends", 68);
    logStep(jobId, "calculating_trends");

    await updateJobStep(jobId, "scoring_viability", 78);
    logStep(jobId, "scoring_viability", {
      score: enhancedAnalysis.viabilityScore.total,
      classification: enhancedAnalysis.viabilityScore.classification
    });

    logStep(jobId, "workforce_capacity_analysis", {
      memory: memorySnapshot()
    });
    const workforceCapacityAnalysis = await workforceCapacityAnalysisService({
      organizationName: enhancedAnalysis.organization.legalName || assessment.profile.organization,
      websiteUrl: enhancedAnalysis.organization.website || assessment.profile.websiteUrl,
      enhancedAnalysis
    });

    await updateJobStep(jobId, "generating_report", 88);
    logStep(jobId, "generating_report", {
      sourceCount: enhancedAnalysis.sources.length,
      openRoles: workforceCapacityAnalysis.metrics.totalOpenPositions,
      staffingRisk: workforceCapacityAnalysis.riskScore.level,
      memory: memorySnapshot()
    });

    const report = await buildGeneratedReport({
      profile: assessment.profile,
      responses: assessment.responses,
      result: assessment.result,
      enhancedAnalysis,
      workforceCapacityAnalysis
    });

    job = await getJob(jobId);
    await saveJobResults(job, enhancedAnalysis, workforceCapacityAnalysis, report);
    logStep(jobId, "completed", { memory: memorySnapshot() });
  } catch (error) {
    console.error("Analysis job failed", {
      jobId,
      error,
      memory: memorySnapshot()
    });

    await updateJob(jobId, {
      status: "failed",
      currentStep: "failed",
      progressPercent: 100,
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString()
    });
  }
}

function logStep(jobId: string, step: string, details: Record<string, unknown> = {}) {
  console.log("Analysis job step", {
    jobId,
    step,
    ...details,
    memory: memorySnapshot()
  });
}

function memorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024)
  };
}
