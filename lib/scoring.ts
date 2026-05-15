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
  founderMarketFit: string;
};

export type PositiveDimension =
  | "Problem Severity"
  | "Buyer Urgency"
  | "Budget Availability"
  | "Market Timing"
  | "ICP Reachability"
  | "Founder-Market Fit"
  | "Evidence of Demand";

export type PenaltyDimension =
  | "Competitive Intensity"
  | "Switching Friction"
  | "Weak Differentiation"
  | "Distribution Disadvantage";

export type ScoringDimension = PositiveDimension | PenaltyDimension;

export type ScoreBreakdown = {
  category: "positive" | "penalty";
  dimension: ScoringDimension;
  maxPoints: number;
  points: number;
  rationale: string;
};

export type ScoringResult = {
  total: number;
  positiveScore: number;
  penaltyScore: number;
  maturityLabel: string;
  breakdown: ScoreBreakdown[];
  positiveBreakdown: ScoreBreakdown[];
  penaltyBreakdown: ScoreBreakdown[];
  topStrengths: string[];
  topRisks: string[];
  recommendedActions: string[];
  investorReadinessConclusion: string;
  executiveSummary: string;
  icpHypotheses: string[];
  painProxyAnalysis: string[];
  competitiveAlternatives: string[];
  messagingRecommendations: string[];
  validationGaps: string[];
  discoveryQuestions: string[];
  recommendedExperiments: string[];
};

const positiveWeights: Record<PositiveDimension, number> = {
  "Problem Severity": 25,
  "Buyer Urgency": 20,
  "Budget Availability": 15,
  "Market Timing": 10,
  "ICP Reachability": 10,
  "Founder-Market Fit": 10,
  "Evidence of Demand": 10
};

const penaltyWeights: Record<PenaltyDimension, number> = {
  "Competitive Intensity": 10,
  "Switching Friction": 10,
  "Weak Differentiation": 10,
  "Distribution Disadvantage": 10
};

const usageSignals = ["usage", "retention", "revenue", "paying", "paid", "customer", "pilot", "contract", "loi", "waitlist", "preorder", "design partner"];
const severitySignals = ["revenue", "churn", "risk", "compliance", "security", "deadline", "downtime", "fraud", "manual", "expensive", "waste", "wasted", "time", "lost", "delay", "forecast", "pipeline", "audit", "mission-critical"];
const lowSeveritySignals = ["nice-to-have", "convenience", "fun", "novelty", "consumer gadget", "juice", "lifestyle", "entertainment"];
const urgencySignals = ["urgent", "deadline", "audit", "board", "quarter", "forecast", "compliance", "risk", "customer", "churn", "breach", "critical", "manual hours", "waste time"];
const budgetSignals = ["budget", "$", "pricing", "seat", "monthly", "annual", "buyer", "department", "cost", "contract", "procurement", "vp", "cfo", "cio", "head of"];
const timingSignals = ["regulation", "ai", "platform", "macro", "now", "shift", "new", "recent", "cost pressure", "remote", "privacy", "automation", "rates"];
const founderSignals = ["founder", "former", "operator", "domain", "worked", "built", "network", "advisor", "audience", "distribution", "expert", "experience", "industry"];
const matureCategorySignals = ["crm", "sales enablement", "email", "project management", "analytics", "marketing automation", "helpdesk", "customer support", "collaboration", "productivity"];
const incumbentSignals = ["salesforce", "hubspot", "microsoft", "google", "zoho", "pipedrive", "nimble", "gong", "clari", "notion", "slack", "zendesk", "intercom", "oracle", "sap", "adobe"];
const switchingSignals = ["crm", "erp", "system of record", "migration", "implementation", "integrations", "workflow", "data", "training", "procurement", "compliance", "salesforce"];
const differentiationSignals = ["proprietary", "unique", "patent", "exclusive", "network effect", "dataset", "workflow data", "real-time", "10x", "novel", "new category", "integrated distribution"];
const weakDifferentiationSignals = ["better", "simpler", "easier", "modern", "all-in-one", "ai-powered", "dashboard", "crm", "blockchain", "web3", "crypto", "marketplace"];
const distributionSignals = ["community", "audience", "partner", "channel", "seo", "inbound", "sales motion", "founder network", "proprietary distribution", "integrations", "marketplace listing", "waitlist"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function hasAny(value: string, signals: string[]) {
  const text = normalize(value);
  return signals.some((signal) => text.includes(signal));
}

function countAny(value: string, signals: string[]) {
  const text = normalize(value);
  return signals.filter((signal) => text.includes(signal)).length;
}

function richness(value: string, thresholds: [number, number, number]) {
  const words = normalize(value).split(/\s+/).filter(Boolean).length;
  if (words >= thresholds[2]) return 1;
  if (words >= thresholds[1]) return 0.72;
  if (words >= thresholds[0]) return 0.42;
  return words > 0 ? 0.22 : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampPositive(value: number, max: number) {
  return clamp(value, 0, max);
}

function splitList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreRatio(value: string, thresholds: [number, number, number], signals: string[], maxSignalBonus = 0.28) {
  return Math.min(1, richness(value, thresholds) * 0.78 + Math.min(maxSignalBonus, countAny(value, signals) * 0.08));
}

export function getMaturityLabel(total: number) {
  if (total >= 90) return "Exceptional / category-defining / highly fundable";
  if (total >= 80) return "Very strong opportunity";
  if (total >= 70) return "Solid opportunity with addressable risks";
  if (total >= 60) return "Viable but constrained";
  if (total >= 50) return "Significant readiness gaps";
  return "Weak market readiness";
}

function makePositive(dimension: PositiveDimension, points: number, rationale: string): ScoreBreakdown {
  return {
    category: "positive",
    dimension,
    maxPoints: positiveWeights[dimension],
    points: clampPositive(points, positiveWeights[dimension]),
    rationale
  };
}

function makePenalty(dimension: PenaltyDimension, points: number, rationale: string): ScoreBreakdown {
  return {
    category: "penalty",
    dimension,
    maxPoints: penaltyWeights[dimension],
    points: -clampPositive(points, penaltyWeights[dimension]),
    rationale
  };
}

function getPositiveBreakdown(input: AssessmentInput, competitors: string[]) {
  const evidenceText = `${input.existingEvidence} ${input.problemSolved} ${input.productDescription}`;
  const buyerText = `${input.economicBuyer} ${input.targetCustomer} ${input.proposedPricing}`;
  const timingText = `${input.marketCategory} ${input.whyNow} ${input.productDescription}`;
  const founderText = `${input.founderMarketFit} ${input.existingEvidence}`;

  const severityRatio = Math.max(
    scoreRatio(`${input.problemSolved} ${input.productDescription}`, [6, 16, 34], severitySignals, 0.48),
    hasAny(`${input.problemSolved} ${input.productDescription}`, lowSeveritySignals) ? 0.28 : 0
  );
  const problemSeverity = makePositive(
    "Problem Severity",
    positiveWeights["Problem Severity"] * (hasAny(`${input.problemSolved} ${input.productDescription}`, lowSeveritySignals) ? Math.min(severityRatio, 0.42) : severityRatio),
    hasAny(`${input.problemSolved} ${input.productDescription}`, severitySignals)
      ? "The problem maps to meaningful pain such as cost, risk, revenue impact, manual work, compliance, or executive visibility."
      : "The problem needs a sharper cost, risk, frequency, or mission-critical consequence."
  );

  const urgencyRatio = scoreRatio(`${input.problemSolved} ${input.whyNow} ${input.existingEvidence}`, [6, 16, 34], urgencySignals, 0.4);
  const buyerUrgency = makePositive(
    "Buyer Urgency",
    positiveWeights["Buyer Urgency"] * urgencyRatio,
    hasAny(`${input.problemSolved} ${input.whyNow}`, urgencySignals)
      ? "The buyer appears to have a time-sensitive reason to act."
      : "Urgency is not yet tied to a deadline, loss, executive pressure, or unavoidable workflow failure."
  );

  const budgetRatio = scoreRatio(buyerText, [8, 18, 34], budgetSignals, 0.34);
  const budgetAvailability = makePositive(
    "Budget Availability",
    positiveWeights["Budget Availability"] * budgetRatio,
    hasAny(buyerText, budgetSignals)
      ? "The buyer and pricing context indicate a plausible budget owner or replaceable spend."
      : "Budget ownership is still fuzzy; name the economic buyer, current spend, and buying trigger."
  );

  const timingRatio = scoreRatio(timingText, [5, 12, 28], timingSignals, 0.36);
  const marketTiming = makePositive(
    "Market Timing",
    positiveWeights["Market Timing"] * timingRatio,
    hasAny(timingText, timingSignals)
      ? "The timing case points to external shifts that could make adoption easier now."
      : "The timing case needs a clearer external force that explains why this opportunity opens now."
  );

  const reachRatio = Math.min(
    1,
    richness(input.targetCustomer, [3, 8, 16]) * 0.58 +
      richness(input.geography, [1, 3, 7]) * 0.16 +
      Math.min(0.16, competitors.length * 0.04) +
      (input.stage ? 0.1 : 0)
  );
  const icpReachability = makePositive(
    "ICP Reachability",
    positiveWeights["ICP Reachability"] * reachRatio,
    "Reachability reflects how specifically the initial customer segment, geography, category, and buyer universe are defined."
  );

  const founderRatio = scoreRatio(founderText, [6, 16, 32], founderSignals, 0.4);
  const founderMarketFit = makePositive(
    "Founder-Market Fit",
    positiveWeights["Founder-Market Fit"] * founderRatio,
    hasAny(founderText, founderSignals)
      ? "Founder-market fit suggests relevant domain insight, network, credibility, or distribution advantage."
      : "Founder-market fit is not yet explicit; investors will look for domain expertise, access, or a proprietary insight."
  );

  const demandRatio = scoreRatio(evidenceText, [8, 18, 38], usageSignals, 0.45);
  const evidenceOfDemand = makePositive(
    "Evidence of Demand",
    positiveWeights["Evidence of Demand"] * demandRatio,
    hasAny(evidenceText, usageSignals)
      ? "Evidence includes demand signals such as interviews, pilots, paid intent, usage, waitlist, revenue, or retention."
      : "Demand evidence is mostly narrative; stronger proof would come from interviews, waitlists, pilots, paid usage, revenue, or retention."
  );

  return [problemSeverity, buyerUrgency, budgetAvailability, marketTiming, icpReachability, founderMarketFit, evidenceOfDemand];
}

function getPenaltyBreakdown(input: AssessmentInput, alternatives: string[], competitors: string[]) {
  const fullText = `${input.startupName} ${input.productDescription} ${input.marketCategory} ${input.currentAlternatives} ${input.competitors} ${input.whyNow}`;
  const categoryText = `${input.marketCategory} ${input.competitors} ${input.currentAlternatives}`;
  const differentiationText = `${input.productDescription} ${input.whyNow} ${input.existingEvidence}`;
  const distributionText = `${input.founderMarketFit} ${input.existingEvidence} ${input.whyNow}`;

  const competitiveRaw =
    Math.min(3, competitors.length * 0.6) +
    countAny(categoryText, matureCategorySignals) * 1.2 +
    Math.min(2.5, countAny(categoryText, incumbentSignals) * 0.75) +
    (hasAny(fullText, ["crm", "customer relationship management"]) ? 1 : 0);
  const competitiveIntensity = makePenalty(
    "Competitive Intensity",
    competitiveRaw,
    competitiveRaw >= 7
      ? "The category appears mature or crowded with entrenched incumbents, so clear buyer demand is not enough for venture attractiveness."
      : "Competitive pressure appears manageable, but the market still needs proof that buyers will switch."
  );

  const switchingRaw =
    countAny(`${input.currentAlternatives} ${input.competitors}`, switchingSignals) * 1.4 +
    (alternatives.length ? 1.8 : 3) +
    (hasAny(fullText, ["hardware", "device", "appliance"]) ? 2 : 0) -
    (hasAny(fullText, ["api", "overlay", "plugin", "no migration", "lightweight"]) ? 2 : 0);
  const switchingFriction = makePenalty(
    "Switching Friction",
    switchingRaw,
    switchingRaw >= 7
      ? "Adoption likely requires workflow change, data migration, integrations, procurement, training, or replacement of a core system."
      : "Switching friction looks addressable if the product can enter through a narrow workflow or low-risk pilot."
  );

  const weakDifferentiationRaw =
    countAny(differentiationText, weakDifferentiationSignals) * 0.7 +
    (hasAny(differentiationText, differentiationSignals) ? 1 : 2) +
    (hasAny(fullText, ["blockchain", "web3", "crypto", "hype"]) ? 4 : 0) +
    (hasAny(fullText, ["crm"]) ? 1 : 0) +
    (hasAny(fullText, ["consumer", "hardware", "device", "appliance", "wellness", "juice"]) ? 5 : 0);
  const weakDifferentiation = makePenalty(
    "Weak Differentiation",
    weakDifferentiationRaw,
    weakDifferentiationRaw >= 7
      ? "The differentiation appears incremental, generic, hype-driven, or easy for incumbents to copy."
      : "Differentiation appears plausible, but it still needs proof through switching behavior, proprietary insight, or unique distribution."
  );

  const hasDistributionAdvantage =
    hasAny(distributionText, distributionSignals) &&
    !hasAny(distributionText, ["no proprietary distribution", "no distribution advantage", "without distribution", "no unfair access"]);
  const distributionRaw =
    (hasDistributionAdvantage ? 1.5 : 3.25) +
    (competitiveIntensity.points <= -7 ? 1 : 0) -
    (hasAny(input.existingEvidence, ["inbound", "waitlist", "community", "partner", "referral"]) ? 2 : 0);
  const distributionDisadvantage = makePenalty(
    "Distribution Disadvantage",
    distributionRaw,
    distributionRaw >= 7
      ? "The market appears hard to reach without a proprietary channel, community, partner motion, founder network, or differentiated wedge."
      : "Distribution risk is manageable if the team can prove a repeatable wedge into the initial ICP."
  );

  return [competitiveIntensity, switchingFriction, weakDifferentiation, distributionDisadvantage];
}

function getTopStrengths(positiveBreakdown: ScoreBreakdown[]) {
  return positiveBreakdown
    .filter((item) => item.points / item.maxPoints >= 0.62)
    .sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)
    .slice(0, 3)
    .map((item) => `${item.dimension}: ${item.rationale}`);
}

function getTopRisks(positiveBreakdown: ScoreBreakdown[], penaltyBreakdown: ScoreBreakdown[]) {
  const penaltyRisks = penaltyBreakdown
    .filter((item) => item.points <= -4)
    .sort((a, b) => a.points - b.points)
    .map((item) => `${item.dimension}: ${item.rationale}`);
  const weakPositiveRisks = positiveBreakdown
    .filter((item) => item.points / item.maxPoints < 0.55)
    .sort((a, b) => a.points / a.maxPoints - b.points / b.maxPoints)
    .map((item) => `${item.dimension}: ${item.rationale}`);

  return [...penaltyRisks, ...weakPositiveRisks].slice(0, 3);
}

function getRecommendedActions(topRisks: string[], positiveBreakdown: ScoreBreakdown[], penaltyBreakdown: ScoreBreakdown[]) {
  const actions: string[] = [];
  const riskText = `${topRisks.join(" ")} ${penaltyBreakdown.map((item) => `${item.dimension} ${item.points}`).join(" ")}`;

  if (riskText.includes("Competitive Intensity")) {
    actions.push("Narrow the wedge to a segment where incumbents are structurally weak, not merely slower or more expensive.");
  }
  if (riskText.includes("Weak Differentiation")) {
    actions.push("Define a 10x differentiation claim backed by proprietary data, workflow lock-in, unique insight, or a hard-to-copy distribution advantage.");
  }
  if (riskText.includes("Switching Friction")) {
    actions.push("Design a low-friction pilot that sits beside the current system before asking buyers to replace it.");
  }
  if (riskText.includes("Distribution Disadvantage")) {
    actions.push("Prove a repeatable acquisition wedge through founder network, community, integrations, partners, or high-intent outbound.");
  }
  if (positiveBreakdown.some((item) => item.dimension === "Evidence of Demand" && item.points / item.maxPoints < 0.6)) {
    actions.push("Collect sharper demand evidence: paid pilots, LOIs, waitlist conversion, repeated usage, revenue, or retention.");
  }
  if (positiveBreakdown.some((item) => item.dimension === "Founder-Market Fit" && item.points / item.maxPoints < 0.6)) {
    actions.push("Make founder-market fit explicit with domain experience, unfair access, advisor network, or proprietary market insight.");
  }

  return actions.slice(0, 4);
}

function getInvestorConclusion(total: number, penaltyScore: number, label: string) {
  if (total >= 90) return `Investor-readiness conclusion: ${label}, with enough severity, urgency, timing, differentiation, and risk control to merit serious venture attention.`;
  if (total >= 80) return `Investor-readiness conclusion: ${label}, but the company should still prove the riskiest penalty before leaning into a fundraise narrative.`;
  if (total >= 70) return `Investor-readiness conclusion: ${label}; the opportunity is credible, but risk-adjusted venture attractiveness depends on resolving the top penalties.`;
  if (total >= 60) return `Investor-readiness conclusion: ${label}; this may be a viable business, but venture-scale attractiveness is constrained by ${Math.abs(penaltyScore)} points of risk adjustments.`;
  return `Investor-readiness conclusion: ${label}; the current evidence does not yet support a strong venture-backed opportunity narrative.`;
}

export function scoreAssessment(input: AssessmentInput): ScoringResult {
  const alternatives = splitList(input.currentAlternatives);
  const competitors = splitList(input.competitors);
  const positiveBreakdown = getPositiveBreakdown(input, competitors);
  const penaltyBreakdown = getPenaltyBreakdown(input, alternatives, competitors);
  const positiveScore = positiveBreakdown.reduce((sum, item) => sum + item.points, 0);
  const penaltyScore = penaltyBreakdown.reduce((sum, item) => sum + item.points, 0);
  const total = clamp(positiveScore + penaltyScore, 0, 100);
  const maturityLabel = getMaturityLabel(total);
  const name = input.startupName || "This startup";
  const target = input.targetCustomer || "the target customer";
  const category = input.marketCategory || "its category";
  const topStrengths = getTopStrengths(positiveBreakdown);
  const topRisks = getTopRisks(positiveBreakdown, penaltyBreakdown);
  const recommendedActions = getRecommendedActions(topRisks, positiveBreakdown, penaltyBreakdown);
  const investorReadinessConclusion = getInvestorConclusion(total, penaltyScore, maturityLabel);

  return {
    total,
    positiveScore,
    penaltyScore,
    maturityLabel,
    breakdown: [...positiveBreakdown, ...penaltyBreakdown],
    positiveBreakdown,
    penaltyBreakdown,
    topStrengths: topStrengths.length ? topStrengths : ["No standout strength yet; the opportunity needs sharper evidence, urgency, differentiation, or founder-market fit."],
    topRisks: topRisks.length ? topRisks : ["No major risk adjustment dominates, but continue validating competition, switching friction, differentiation, and distribution."],
    recommendedActions: recommendedActions.length ? recommendedActions : ["Continue validating willingness to pay, repeatable reachability, and defensible differentiation before making a venture-scale claim."],
    investorReadinessConclusion,
    executiveSummary: `${name} scores ${total}/100 for venture-adjusted Market Readiness in ${category}. This assesses opportunity attractiveness for ${target}; it does not claim product-market fit without actual customer usage, revenue, and retention data.`,
    icpHypotheses: [
      `${target} with an active budget owner who feels "${input.problemSolved || "the core problem"}" frequently enough to change behavior.`,
      `${input.geography || "Priority markets"} buyers currently using ${alternatives[0] || "manual workarounds"} and showing clear switching urgency.`,
      `${input.stage} teams where the economic buyer can approve ${input.proposedPricing || "a focused pilot"} without a long platform replacement cycle.`
    ],
    painProxyAnalysis: [
      alternatives.length
        ? `Current alternatives such as ${alternatives.slice(0, 3).join(", ")} indicate buyers may already be paying in time, attention, or budget.`
        : "Current alternatives are under-specified, so the strongest pain proxies still need to be found.",
      input.existingEvidence
        ? "Existing evidence should be separated into curiosity, intent, paid demand, usage, revenue, and retention so the score does not over-reward narrative evidence."
        : "Evidence of demand is missing; add interviews, waitlist conversion, paid pilots, usage frequency, revenue, or retention.",
      `The proposed buyer is ${input.economicBuyer || "not yet defined"}, which affects urgency, procurement path, and messaging.`
    ],
    competitiveAlternatives: competitors.length
      ? competitors.map((competitor) => `${competitor}: validate whether buyers see it as too broad, too costly, too slow, too manual, or too entrenched to displace.`)
      : ["No named competitors were provided. Add direct competitors, indirect substitutes, internal spreadsheets, agencies, and status quo behavior."],
    messagingRecommendations: [
      `Lead with the expensive, urgent consequence of ${input.problemSolved || "the problem"}, not the product category.`,
      "Frame Market Fit Likelihood as a risk-adjusted view of severity, urgency, budget, timing, reachability, founder-market fit, demand evidence, and venture penalties.",
      "Avoid saying product-market fit. Use Market Readiness, Problem-Market Fit, and Market Fit Likelihood until usage, revenue, and retention prove otherwise."
    ],
    validationGaps: [...positiveBreakdown.filter((item) => item.points / item.maxPoints < 0.65), ...penaltyBreakdown.filter((item) => item.points <= -6)].map(
      (item) => `${item.dimension}: ${item.rationale}`
    ),
    discoveryQuestions: [
      `What triggered ${target} to look for a solution in the last 30 days?`,
      "What budget, tool, headcount, or services spend does this replace?",
      `Which alternative would the economic buyer choose if ${name} did not exist?`,
      "What would make this 10x better than the entrenched incumbent or status quo?",
      "What repeatable distribution wedge gives this team an advantage before incumbents react?"
    ],
    recommendedExperiments: [
      "Run 15 structured discovery calls and score each by severity, urgency, budget owner, current alternative, and switching trigger.",
      "Launch a paid pilot or LOI test that proves willingness to pay in the first ICP, not just interest.",
      "Create a competitor-switch interview script to learn what would cause buyers to abandon the status quo.",
      "Test one distribution wedge with a measurable conversion target before broadening the category story.",
      "Define the narrow wedge where the product is meaningfully differentiated and incumbents are least likely to respond quickly."
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
  stage: "Idea",
  founderMarketFit: ""
};

export const storageKey = "fitproof.assessment.v1";
