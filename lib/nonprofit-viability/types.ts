export type ExtractionMethod = "audit" | "990" | "state filing" | "website" | "annual report" | "manual upload" | "public record";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ViabilitySourceType =
  | "uploaded_audit"
  | "website_audit"
  | "state_registry"
  | "irs_990"
  | "propublica"
  | "annual_report"
  | "website"
  | "public_record";

export type NonprofitSearchInput = {
  name?: string;
  ein?: string;
  state?: string;
  website?: string;
};

export type Organization = {
  id: string;
  legalName: string | null;
  dbaNames: string[];
  ein: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  nteeCode: string | null;
  exemptionStatus: string | null;
  sourceConfidence: ConfidenceLevel;
  sources: SourceDocument[];
};

export type SourceDocument = {
  id: string;
  organizationId?: string;
  title: string;
  url?: string;
  filePath?: string;
  sourceType: ViabilitySourceType;
  fiscalYear?: number | null;
  confidence: ConfidenceLevel;
  extractionMethod: ExtractionMethod;
  retrievedAt: string;
  notes?: string;
  textExcerpt?: string;
};

export type FinancialMetricName =
  | "totalRevenue"
  | "totalExpenses"
  | "surplusDeficit"
  | "surplusMargin"
  | "revenueGrowth"
  | "expenseGrowth"
  | "cashAndInvestments"
  | "currentAssets"
  | "currentLiabilities"
  | "totalAssets"
  | "totalLiabilities"
  | "workingCapital"
  | "currentRatio"
  | "monthsCashOnHand"
  | "netAssetsWithoutDonorRestrictions"
  | "netAssetsWithDonorRestrictions"
  | "debt"
  | "fundraisingExpenseRatio"
  | "programExpenseRatio"
  | "managementGeneralExpenseRatio"
  | "revenueConcentration";

export type FinancialMetric = {
  name: FinancialMetricName;
  label: string;
  value: number | null;
  fiscalYear: number;
  source: string;
  confidence: ConfidenceLevel;
  extractionMethod: ExtractionMethod;
  sourceNote?: string;
};

export type FinancialYear = {
  fiscalYear: number;
  sourcePriority: number;
  sourceNote: string;
  metrics: FinancialMetric[];
};

export type ViabilityScore = {
  total: number;
  classification: "Stable / growth-ready" | "Generally viable with watch areas" | "Operationally strained" | "Financially vulnerable" | "High viability risk";
  categories: {
    liquidity: number;
    revenueTrend: number;
    expenseDiscipline: number;
    surplusDeficitTrend: number;
    netAssetStrength: number;
    revenueConcentrationRisk: number;
    complianceGovernanceSignals: number;
    operationalComplexityStrainSignals: number;
  };
  riskFlags: string[];
};

export type AssessmentResponseRecord = {
  questionId: string;
  question: string;
  answer: string | string[] | null;
};

export type WebsiteAnalysis = {
  missionStatement: string | null;
  programDescriptions: string[];
  leadershipTeam: string[];
  boardMembers: string[];
  donationCta: string | null;
  annualReportLinks: string[];
  auditFinancialLinks: string[];
  strategicPriorities: string[];
  majorFunders: string[];
  programExpansionSignals: string[];
  operationalComplexitySignals: string[];
  sources: SourceDocument[];
};

export type AnnualReportSophisticationScore = {
  totalScore: number;
  categories: {
    outcomeMeasurement: number;
    financialTransparency: number;
    strategicClarity: number;
    programPerformanceVisibility: number;
    governanceLeadershipTransparency: number;
    growthOperationalMaturitySignals: number;
    dataReportingMaturity: number;
  };
  findings: string[];
  confidence: ConfidenceLevel;
};

export type AnnualReportAnalysis = {
  status: "found" | "not_found" | "uploaded";
  sourceDocument: SourceDocument | null;
  score: AnnualReportSophisticationScore | null;
  signals: {
    strategicPriorities: string[];
    measurableOutcomes: string[];
    programPerformanceMetrics: string[];
    revenueFundingNarrative: string[];
    donorFunderTransparency: string[];
    leadershipBoardTransparency: string[];
    dataDashboardReferences: string[];
    multiYearTrendVisibility: string[];
    operationalWorkforceChallenges: string[];
    growthGoals: string[];
    technologyModernizationReferences: string[];
  };
  notes: string[];
};

export type WebsiteSophisticationScore = {
  totalScore: number;
  categories: {
    missionClarity: number;
    donationPathwayClarity: number;
    volunteerPathwayClarity: number;
    programServiceClarity: number;
    impactEvidence: number;
    financialTransparencySignals: number;
    leadershipBoardVisibility: number;
    callsToActionQuality: number;
    mobileUsabilityAccessibilitySignals: number;
  };
  strongestSignals: string[];
  weakestSignals: string[];
  recommendations: string[];
  confidence: ConfidenceLevel;
};

export type WebsiteSophisticationAnalysis = {
  score: WebsiteSophisticationScore | null;
  primaryCallsToAction: string[];
  donateButtonPresence: "prominent" | "present" | "not_detected";
  volunteerCtaPresence: "present" | "not_detected";
  programDescriptions: string[];
  impactMetrics: string[];
  annualReportLinks: string[];
  financialLinks: string[];
  leadershipBoardPages: string[];
  accessibilityIssues: string[];
  confusingOrMissingPathways: string[];
  notes: string[];
};

export type AuditExtraction = {
  sourceDocument: SourceDocument;
  fields: Record<
    | "cashAndCashEquivalents"
    | "currentAssets"
    | "currentLiabilities"
    | "totalAssets"
    | "totalLiabilities"
    | "netAssetsWithDonorRestrictions"
    | "netAssetsWithoutDonorRestrictions"
    | "operatingRevenue"
    | "operatingExpenses"
    | "changeInNetAssets"
    | "debt"
    | "investments",
    FinancialMetric | null
  >;
  liquidityNote: string | null;
  goingConcernLanguage: string | null;
  auditOpinion: string | null;
  materialWeaknessesOrSignificantDeficiencies: string | null;
  extractionNotes: string[];
};

export type RegistrySearchResult = {
  state: string;
  status: string | null;
  searchUrl: string;
  notes: string;
  sources: SourceDocument[];
};

export type PublicRecordSignal = {
  title: string;
  url?: string;
  signalType: "exemption" | "secretary_of_state" | "litigation" | "enforcement" | "news" | "other";
  relevance: string;
  confidence: ConfidenceLevel;
};

export type GeneratedReport = {
  organizationId: string;
  generatedAt: string;
  organizationProfile: Organization;
  sources: SourceDocument[];
  financialYears: FinancialYear[];
  viabilityScore: ViabilityScore;
  executiveNarrative: string;
  revenueExpenseTrendNarrative: string;
  surplusDeficitAnalysis: string;
  liquidityRunwayAnalysis: string;
  restrictedNetAssetAnalysis: string;
  complianceGovernanceObservations: string;
  recommendedFitProofNextSteps: string[];
  operationalOptimizationOpportunities: string[];
  aiAutomationOpportunities: string[];
  riskFlags: string[];
};

export type EnhancedAnalysisRequest = NonprofitSearchInput & {
  includePublicRecordsSearch?: boolean;
  includeStateRegistrySearch?: boolean;
  uploadedDocumentIds?: string[];
  uploadedAuditExtractions?: AuditExtraction[];
  assessmentResponses?: AssessmentResponseRecord[];
};

export type EnhancedAnalysisResult = {
  organization: Organization;
  sources: SourceDocument[];
  websiteAnalysis: WebsiteAnalysis;
  websiteSophistication: WebsiteSophisticationAnalysis;
  annualReportAnalysis: AnnualReportAnalysis;
  registryResults: RegistrySearchResult[];
  publicRecords: PublicRecordSignal[];
  financialYears: FinancialYear[];
  viabilityScore: ViabilityScore;
  report: GeneratedReport;
};
