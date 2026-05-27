import { AssessmentResult, GeneratedExecutiveReport, Lead, Profile, Responses } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";

export type AnalysisStatus = "queued" | "running" | "completed" | "failed";

export type AnalysisStep =
  | "queued"
  | "identifying_organization"
  | "fetching_sources"
  | "parsing_documents"
  | "extracting_financials"
  | "calculating_trends"
  | "scoring_viability"
  | "generating_report"
  | "completed"
  | "failed";

export type AnalysisAssessment = {
  id: string;
  profile: Profile;
  lead?: Lead;
  responses: Responses;
  result: AssessmentResult;
  createdAt: string;
};

export type AnalysisJob = {
  id: string;
  assessmentId: string;
  organizationId: string;
  status: AnalysisStatus;
  currentStep: AnalysisStep;
  progressPercent: number;
  errorMessage: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisJobResults = {
  assessment: AnalysisAssessment;
  job: AnalysisJob;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  report: GeneratedExecutiveReport | null;
};
