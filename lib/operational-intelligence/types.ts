export type ScoreCategory =
  | "Financial Stability"
  | "Workforce Capacity"
  | "Revenue Operations"
  | "Governance & Compliance"
  | "Technology & Systems"
  | "Strategic Clarity"
  | "AI/Automation Readiness";

export type ScoreBand = "strong" | "watch" | "constrained" | "critical" | "unknown";

export type OrganizationalHealthScore = {
  totalScore: number;
  categoryScores: Record<ScoreCategory, number>;
  percentileRanking: number | null;
};

export type GrowthReadinessScore = {
  score: number;
  classification: "Growth-ready" | "Ready with watch areas" | "Constrained" | "Not ready to scale";
  growthConstraints: string[];
  scaleEnablers: string[];
};

export type OperationalStrainSpiralStage =
  | "Stable Foundation"
  | "Emerging Complexity"
  | "Reactive Scaling"
  | "Operational Strain"
  | "Capacity Constraint"
  | "Sustainability Risk";

export type OperationalStrainSpiralClassification = {
  currentStage: OperationalStrainSpiralStage;
  stageDescription: string;
  stageConfidence: number;
  primaryStrainDrivers: string[];
  likelyFutureRisks: string[];
};

export type BenchmarkComparison = {
  metric: string;
  organizationValue: number | null;
  organizationDisplay: string;
  peerMedian: number | null;
  peerMedianDisplay: string;
  percentile: number | null;
  quartile: "Top quartile" | "Second quartile" | "Third quartile" | "Bottom quartile" | "Unavailable";
  benchmarkGroup: string;
  note: string;
};

export type FinancialTrendPoint = {
  fiscalYear: number;
  revenue: number | null;
  expenses: number | null;
  surplusDeficit: number | null;
};

export type ExecutiveKpi = {
  label: string;
  value: string;
  indicator: ScoreBand;
  source: string;
};

export type ExecutiveKpiGroup = {
  title: "Financial Stability KPIs" | "Operational KPIs" | "Growth KPIs" | "Governance KPIs";
  items: ExecutiveKpi[];
};

export type ExecutiveSnapshot = {
  operationalStrainScore: number;
  organizationalHealthScore: number;
  growthReadinessScore: number;
  operationalStrainSpiralStage: OperationalStrainSpiralStage;
  financialStabilityIndicator: ScoreBand;
  workforceCapacityIndicator: ScoreBand;
  benchmarkPercentile: number | null;
};

export type SupportingMetric = {
  label: string;
  value: string;
  source: string;
};

export type WorkforceExtractionDebug = {
  careersPageFound: string | null;
  atsPlatformDetected: string | null;
  postingsExtracted: number;
  postingsAfterDeduplication: number;
  sourceUrlsCrawled: string[];
  pagesCrawled: number;
  rawJobCount: number;
  deduplicatedJobCount: number;
  extractionErrors: string[];
  javascriptRenderingRequired: boolean;
};

export type OperationalIntelligenceReport = {
  executiveSnapshot: ExecutiveSnapshot;
  executiveSummaryParagraphs: string[];
  organizationalHealthScore: OrganizationalHealthScore;
  growthReadinessScore: GrowthReadinessScore;
  operationalStrainSpiral: OperationalStrainSpiralClassification;
  keyFindings: string[];
  benchmarkHighlights: BenchmarkComparison[];
  financialTrend: FinancialTrendPoint[];
  executiveKpis: ExecutiveKpiGroup[];
  primaryOperationalRisks: string[];
  growthConstraints: string[];
  recommendedPriorities: string[];
  supportingMetrics: SupportingMetric[];
  workforceExtractionDebug: WorkforceExtractionDebug | null;
  annualReportInsight: {
    status: string;
    score: number | null;
    findings: string[];
    sourceUrl: string | null;
  };
  websitePresenceAssessment: {
    status: string;
    score: number | null;
    strongestSignals: string[];
    weakestSignals: string[];
    impact: string;
    recommendations: string[];
  };
  dataQualityNotes: string[];
};
