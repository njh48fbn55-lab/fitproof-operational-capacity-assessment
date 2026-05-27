import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GeneratedExecutiveReport, Profile, Responses, AssessmentResult, Lead } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { slugify } from "@/lib/nonprofit-viability/utils";
import { AnalysisAssessment, AnalysisJob, AnalysisJobResults, AnalysisStep } from "./types";

export function analysisDataDir() {
  return process.env.ANALYSIS_DATA_DIR || path.join(process.cwd(), "analysis-data");
}

export function makeAnalysisId(prefix: string, value: string) {
  return `${prefix}_${slugify(value)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createAssessmentRecord({
  profile,
  lead,
  responses,
  result
}: {
  profile: Profile;
  lead?: Lead;
  responses: Responses;
  result: AssessmentResult;
}) {
  const now = new Date().toISOString();
  const assessment: AnalysisAssessment = {
    id: makeAnalysisId("assessment", profile.organization || "organization"),
    profile,
    lead,
    responses,
    result,
    createdAt: now
  };

  await writeRecord("assessments", `${assessment.id}.json`, assessment);
  return assessment;
}

export async function createAnalysisJob(assessment: AnalysisAssessment) {
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id: makeAnalysisId("job", assessment.profile.organization || assessment.id),
    assessmentId: assessment.id,
    organizationId: slugify(assessment.profile.organization || "organization"),
    status: "queued",
    currentStep: "queued",
    progressPercent: 0,
    errorMessage: null,
    attempts: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };

  await writeJob(job);
  return job;
}

export async function getAssessment(id: string) {
  return readRecord<AnalysisAssessment>("assessments", `${id}.json`);
}

export async function getJob(id: string) {
  return readRecord<AnalysisJob>("jobs", `${id}.json`);
}

export async function writeJob(job: AnalysisJob) {
  await writeRecord("jobs", `${job.id}.json`, { ...job, updatedAt: new Date().toISOString() });
}

export async function updateJob(id: string, patch: Partial<AnalysisJob>) {
  const job = await getJob(id);
  const next = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeJob(next);
  return next;
}

export async function updateJobStep(id: string, currentStep: AnalysisStep, progressPercent: number) {
  return updateJob(id, {
    status: currentStep === "completed" ? "completed" : currentStep === "failed" ? "failed" : "running",
    currentStep,
    progressPercent
  });
}

export async function saveJobResults(job: AnalysisJob, enhancedAnalysis: EnhancedAnalysisResult | null, report: GeneratedExecutiveReport) {
  const assessment = await getAssessment(job.assessmentId);
  const results: AnalysisJobResults = {
    assessment,
    job: {
      ...job,
      status: "completed",
      currentStep: "completed",
      progressPercent: 100,
      completedAt: new Date().toISOString()
    },
    enhancedAnalysis,
    report
  };

  await writeRecord("results", `${job.id}.json`, results);
  await writeJob(results.job);
  return results;
}

export async function getJobResults(id: string) {
  return readRecord<AnalysisJobResults>("results", `${id}.json`);
}

async function readRecord<T>(folder: string, filename: string) {
  const filePath = path.join(analysisDataDir(), folder, filename);
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text) as T;
}

async function writeRecord(folder: string, filename: string, data: unknown) {
  const dir = path.join(analysisDataDir(), folder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}
