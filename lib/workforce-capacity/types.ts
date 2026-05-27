import { ConfidenceLevel, EnhancedAnalysisResult, SourceDocument } from "@/lib/nonprofit-viability/types";

export type CareersPlatform =
  | "organization"
  | "greenhouse"
  | "lever"
  | "workday"
  | "bamboohr"
  | "jazzhr"
  | "paylocity"
  | "adp"
  | "icims"
  | "unknown";

export type LeadershipLevel = "executive" | "senior_leader" | "manager" | "individual_contributor" | "unknown";

export type CareersCrawlerInput = {
  organizationName?: string | null;
  websiteUrl?: string | null;
};

export type CareersRole = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  requisitionId: string | null;
  postedDate: string | null;
  updatedDate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  employmentType: string | null;
  leadershipLevel: LeadershipLevel;
  requisitionUrl: string;
  platform: CareersPlatform;
  sourceName: string;
  confidence: ConfidenceLevel;
  active: boolean;
};

export type CareersCrawlResult = {
  roles: CareersRole[];
  sources: SourceDocument[];
  searchedUrls: string[];
  notes: string[];
  debug: {
    careersPageFound: string | null;
    atsPlatformDetected: CareersPlatform | null;
    postingsExtracted: number;
    postingsAfterDeduplication: number;
    sourceUrlsCrawled: string[];
  };
};

export type WorkforceSizeEstimate = {
  estimatedEmployeeCount: number | null;
  confidence: ConfidenceLevel;
  sources: string[];
  method: string;
  notes: string[];
};

export type StaffingMetrics = {
  totalOpenPositions: number;
  openPositionsByDepartment: Record<string, number>;
  leadershipOpenings: number;
  openRoleRatio: number | null;
  averageRequisitionAgeDays: number | null;
  percentOpenMoreThan30Days: number | null;
  percentOpenMoreThan60Days: number | null;
  percentOpenMoreThan90Days: number | null;
};

export type StaffingRiskLevel = "low" | "moderate" | "elevated" | "severe";

export type StaffingRiskScore = {
  level: StaffingRiskLevel;
  score: number;
  indicators: string[];
  evidence: string[];
};

export type StaffingNarrative = {
  staffingCapacitySummary: string;
  operationalStrainObservations: string[];
  likelyPressureAreas: string[];
  hiringBottleneckAnalysis: string;
  recommendations: string[];
};

export type WorkforceCapacityAnalysisInput = CareersCrawlerInput & {
  enhancedAnalysis?: EnhancedAnalysisResult | null;
};

export type WorkforceCapacityAnalysis = {
  generatedAt: string;
  careers: CareersCrawlResult;
  workforceSize: WorkforceSizeEstimate;
  metrics: StaffingMetrics;
  riskScore: StaffingRiskScore;
  narrative: StaffingNarrative;
};
