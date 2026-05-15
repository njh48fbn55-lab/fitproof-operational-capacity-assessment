export type Stage =
  | "Idea"
  | "Prototype"
  | "Private beta"
  | "Public beta"
  | "Pre-seed"
  | "Seed";

export type AssessmentInput = {
  startupName: string;
  productDescription: string;
  targetCustomer: string;
  problemSolved: string;
  currentAlternatives: string;
  economicBuyer: string;
  proposedPricing: string;
  marketCategory: string;
  whyNow: string;
  existingEvidence: string;
  competitors: string;
  geography: string;
  stage: Stage;
};

export type ScoringDimension =
  | "Problem Evidence"
  | "Buyer Urgency"
  | "Budget Availability"
  | "Competitive Validation"
  | "ICP Reachability"
  | "Market Timing";

export type ScoreBreakdown = {
  dimension: ScoringDimension;
  maxPoints: number;
  points: number;
  rationale: string;
};

export type ScoringResult = {
  total: number;
  maturityLabel: string;
  breakdown: ScoreBreakdown[];
  executiveSummary: string;
  icpHypotheses: string[];
  painProxyAnalysis: string[];
  competitiveAlternatives: string[];
  messagingRecommendations: string[];
  validationGaps: string[];
  discoveryQuestions: string[];
  recommendedExperiments: string[];
};

const weights: Record<ScoringDimension, number> = {
  "Problem Evidence": 25,
  "Buyer Urgency": 20,
  "Budget Availability": 20,
  "Competitive Validation": 15,
  "ICP Reachability": 10,
  "Market Timing": 10
};

const usageSignals = ["usage", "retention", "revenue", "paying", "paid", "customer", "pilot", "contract"];
const urgencySignals = ["urgent", "manual", "expensive", "wasted", "risk", "compliance", "deadline", "critical", "pain"];
const budgetSignals = ["budget", "$", "pricing", "seat", "monthly", "annual", "buyer", "department", "cost"];
const timingSignals = ["regulation", "ai", "remote", "platform", "macro", "now", "shift", "new", "recent"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function hasAny(value: string, signals: string[]) {
  const text = normalize(value);
  return signals.some((signal) => text.includes(signal));
}

function richness(value: string, thresholds: [number, number, number]) {
  const words = normalize(value).split(/\s+/).filter(Boolean).length;
  if (words >= thresholds[2]) return 1;
  if (words >= thresholds[1]) return 0.72;
  if (words >= thresholds[0]) return 0.42;
  return words > 0 ? 0.22 : 0;
}

function clampPoints(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function getMaturityLabel(total: number) {
  if (total <= 39) return "Weak market evidence";
  if (total <= 59) return "Plausible but unvalidated";
  if (total <= 74) return "Strong external signals";
  if (total <= 89) return "High-confidence market readiness";
  return "Exceptional market pull indicators";
}

export function scoreAssessment(input: AssessmentInput): ScoringResult {
  const evidenceText = `${input.existingEvidence} ${input.problemSolved}`;
  const buyerText = `${input.economicBuyer} ${input.targetCustomer} ${input.proposedPricing}`;
  const marketText = `${input.marketCategory} ${input.whyNow} ${input.competitors}`;
  const alternatives = input.currentAlternatives
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const competitors = input.competitors
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const breakdown: ScoreBreakdown[] = [
    {
      dimension: "Problem Evidence",
      maxPoints: weights["Problem Evidence"],
      points: clampPoints(
        weights["Problem Evidence"] *
          (richness(evidenceText, [10, 28, 55]) + (hasAny(evidenceText, usageSignals) ? 0.25 : 0)) /
          1.25,
        weights["Problem Evidence"]
      ),
      rationale: hasAny(evidenceText, usageSignals)
        ? "Evidence includes concrete external signals such as pilots, paid intent, usage, or customer conversations."
        : "Evidence is mostly descriptive; stronger proof would come from interviews, waitlists, pilots, usage, revenue, or retention."
    },
    {
      dimension: "Buyer Urgency",
      maxPoints: weights["Buyer Urgency"],
      points: clampPoints(
        weights["Buyer Urgency"] *
          (richness(input.problemSolved, [8, 22, 42]) + (hasAny(input.problemSolved, urgencySignals) ? 0.28 : 0)) /
          1.28,
        weights["Buyer Urgency"]
      ),
      rationale: hasAny(input.problemSolved, urgencySignals)
        ? "The described pain suggests a time-sensitive or costly problem."
        : "The pain needs sharper urgency language tied to a deadline, loss, risk, or executive priority."
    },
    {
      dimension: "Budget Availability",
      maxPoints: weights["Budget Availability"],
      points: clampPoints(
        weights["Budget Availability"] *
          (richness(buyerText, [8, 20, 38]) + (hasAny(buyerText, budgetSignals) ? 0.3 : 0)) /
          1.3,
        weights["Budget Availability"]
      ),
      rationale: hasAny(buyerText, budgetSignals)
        ? "The buyer and pricing context indicate a plausible budget owner."
        : "Budget ownership is still fuzzy; name the buyer, current spend, and procurement trigger."
    },
    {
      dimension: "Competitive Validation",
      maxPoints: weights["Competitive Validation"],
      points: clampPoints(
        weights["Competitive Validation"] *
          Math.min(1, 0.22 + alternatives.length * 0.18 + competitors.length * 0.14 + richness(input.currentAlternatives, [4, 12, 24]) * 0.22),
        weights["Competitive Validation"]
      ),
      rationale:
        alternatives.length + competitors.length > 2
          ? "The market shows existing alternatives, which validates pain while raising positioning pressure."
          : "More competitor and workaround detail would clarify whether buyers already spend to solve this."
    },
    {
      dimension: "ICP Reachability",
      maxPoints: weights["ICP Reachability"],
      points: clampPoints(
        weights["ICP Reachability"] *
          Math.min(1, richness(input.targetCustomer, [4, 10, 20]) * 0.65 + richness(input.geography, [1, 3, 7]) * 0.2 + (input.stage ? 0.15 : 0)),
        weights["ICP Reachability"]
      ),
      rationale: "Reachability reflects how specifically the initial customer segment and geography are defined."
    },
    {
      dimension: "Market Timing",
      maxPoints: weights["Market Timing"],
      points: clampPoints(
        weights["Market Timing"] *
          (richness(marketText, [8, 22, 42]) + (hasAny(marketText, timingSignals) ? 0.25 : 0)) /
          1.25,
        weights["Market Timing"]
      ),
      rationale: hasAny(marketText, timingSignals)
        ? "The timing case points to external shifts that could make adoption easier now."
        : "The timing case needs a clearer external trigger that explains why this market opens now."
    }
  ];

  const total = breakdown.reduce((sum, item) => sum + item.points, 0);
  const maturityLabel = getMaturityLabel(total);
  const name = input.startupName || "This startup";
  const target = input.targetCustomer || "the target customer";
  const category = input.marketCategory || "its category";

  return {
    total,
    maturityLabel,
    breakdown,
    executiveSummary: `${name} shows ${maturityLabel.toLowerCase()} for ${target} in ${category}. This report assesses Market Readiness and Problem-Market Fit signals only; it does not claim product-market fit without actual customer usage, revenue, and retention data.`,
    icpHypotheses: [
      `${target} with an active budget owner who already feels the pain described as "${input.problemSolved || "the core problem"}".`,
      `${input.geography || "Priority markets"} buyers comparing ${alternatives[0] || "manual workarounds"} against newer category solutions.`,
      `${input.stage} teams or departments where the economic buyer can approve ${input.proposedPricing || "a clear entry price"} without a long procurement cycle.`
    ],
    painProxyAnalysis: [
      alternatives.length
        ? `Current alternatives such as ${alternatives.slice(0, 3).join(", ")} indicate buyers may already be paying in time, attention, or budget.`
        : "Current alternatives are under-specified, so the strongest pain proxies still need to be found.",
      hasAny(input.existingEvidence, usageSignals)
        ? "Existing evidence contains stronger external signals than narrative conviction alone."
        : "Existing evidence should be converted into observable proof: interview counts, waitlist conversion, paid pilots, usage frequency, or retention.",
      `The proposed buyer is ${input.economicBuyer || "not yet defined"}, which affects urgency, procurement path, and messaging.`
    ],
    competitiveAlternatives: competitors.length
      ? competitors.map((competitor) => `${competitor}: validate where buyers see it as too broad, too costly, too manual, or too slow.`)
      : ["No named competitors were provided. Add direct competitors, indirect substitutes, internal spreadsheets, agencies, and status quo behavior."],
    messagingRecommendations: [
      `Lead with the urgent business cost of ${input.problemSolved || "the problem"}, not with product features.`,
      `Frame FitProof's Market Fit Likelihood around evidence quality, buyer urgency, budget clarity, competitive validation, reachability, and timing.`,
      `Avoid saying product-market fit. Use Market Readiness, Problem-Market Fit, and Market Fit Likelihood until usage, revenue, and retention prove otherwise.`
    ],
    validationGaps: breakdown
      .filter((item) => item.points / item.maxPoints < 0.65)
      .map((item) => `${item.dimension}: ${item.rationale}`),
    discoveryQuestions: [
      `What triggered ${target} to look for a solution in the last 30 days?`,
      `What budget, tool, headcount, or services spend does this replace?`,
      `Which alternative would the economic buyer choose if ${name} did not exist?`,
      "What proof would make a skeptical investor believe this is a real market pull signal?",
      "What behavior would indicate repeated usage or retention after the first successful moment?"
    ],
    recommendedExperiments: [
      "Run 15 structured discovery calls and tag each by pain intensity, current workaround, budget owner, and timing trigger.",
      "Launch a one-page pricing smoke test with two willingness-to-pay tiers and measure qualified demo requests.",
      "Create a competitor-switch interview script to learn what would cause buyers to abandon the status quo.",
      "Recruit five design partners and define a weekly usage or outcome metric before building more product surface.",
      "Publish three tightly targeted messages and compare reply rate by ICP segment and pain statement."
    ]
  };
}

export const emptyAssessment: AssessmentInput = {
  startupName: "",
  productDescription: "",
  targetCustomer: "",
  problemSolved: "",
  currentAlternatives: "",
  economicBuyer: "",
  proposedPricing: "",
  marketCategory: "",
  whyNow: "",
  existingEvidence: "",
  competitors: "",
  geography: "",
  stage: "Idea"
};

export const storageKey = "fitproof.assessment.v1";
