export type ScoreCategory =
  | "Financial Stability"
  | "Workforce Capacity"
  | "Revenue Operations"
  | "Governance & Compliance"
  | "Technology & Systems"
  | "Strategic Clarity"
  | "AI/Automation Readiness";

export type ScoreBand = "strong" | "watch" | "constrained" | "critical" | "unknown";

export type OperationalHealthScore = {
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
  | "Revenue Instability"
  | "Critical Capacity Risk";

export type OperationalStrainSpiralClassification = {
  currentStage: OperationalStrainSpiralStage;
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

export type ExecutiveSnapshot = {
  operationalHealthScore: number;
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

export type OperationalIntelligenceReport = {
  executiveSnapshot: ExecutiveSnapshot;
  operationalHealthScore: OperationalHealthScore;
  growthReadinessScore: GrowthReadinessScore;
  operationalStrainSpiral: OperationalStrainSpiralClassification;
  keyFindings: string[];
  benchmarkHighlights: BenchmarkComparison[];
  primaryOperationalRisks: string[];
  growthConstraints: string[];
  recommendedPriorities: string[];
  supportingMetrics: SupportingMetric[];
};
