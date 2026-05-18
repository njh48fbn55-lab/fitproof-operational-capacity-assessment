export type RevenueStream =
  | "Mixed revenue"
  | "Individual giving"
  | "Major gifts"
  | "Grants"
  | "Corporate sponsorship"
  | "Earned revenue"
  | "Events";

export type ProfileInput = {
  orgName: string;
  primaryRevenueStream: RevenueStream;
  crmSystem: string;
  annualGoal: string;
  cashReceivedYtd: string;
  openPipeline: string;
  committedNotReceived: string;
  overdueCommitments: string;
  noNextStepPercent: string;
};

export type DimensionId =
  | "signalCapture"
  | "qualification"
  | "cultivation"
  | "forecast"
  | "cashRealization"
  | "renewal";

export type Question = {
  id: string;
  dimensionId: DimensionId;
  prompt: string;
  evidence: string;
};

export type Dimension = {
  id: DimensionId;
  title: string;
  shortTitle: string;
  weight: number;
  description: string;
  questions: Question[];
};

export type DimensionScore = {
  id: DimensionId;
  title: string;
  shortTitle: string;
  score: number;
  weightedPoints: number;
  weight: number;
  description: string;
};

export type LeakageStage = {
  stage: string;
  score: number;
  risk: number;
  diagnosis: string;
};

export type AssessmentResult = {
  total: number;
  label: string;
  confidenceWeightedPipeline: number;
  cashAtRisk: number;
  nextStepGap: number;
  goalCoverage: number | null;
  dimensionScores: DimensionScore[];
  leakageMap: LeakageStage[];
  bottleneck: DimensionScore;
  recommendations: string[];
  summary: string;
};

export const revenueStreams: RevenueStream[] = [
  "Mixed revenue",
  "Individual giving",
  "Major gifts",
  "Grants",
  "Corporate sponsorship",
  "Earned revenue",
  "Events"
];

export const ratingLabels = [
  "Not in place",
  "Ad hoc",
  "Partially managed",
  "Managed",
  "Predictable"
];

export const dimensions: Dimension[] = [
  {
    id: "signalCapture",
    title: "Signal Capture",
    shortTitle: "Capture",
    weight: 14,
    description: "How reliably new revenue signals enter the system with enough context to act.",
    questions: [
      {
        id: "lead-source",
        dimensionId: "signalCapture",
        prompt: "New donor, funder, sponsor, referral, and program revenue signals are captured in one shared system.",
        evidence: "Lead source, revenue stream, contact, amount estimate, and owner are visible."
      },
      {
        id: "response-sla",
        dimensionId: "signalCapture",
        prompt: "Inbound revenue opportunities receive a timely first response and a clear owner.",
        evidence: "New opportunities are not waiting in inboxes, event notes, or board conversations."
      },
      {
        id: "source-attribution",
        dimensionId: "signalCapture",
        prompt: "The team can see which sources generate qualified revenue opportunities.",
        evidence: "Campaigns, events, referrals, board introductions, grants, and partners can be compared."
      },
      {
        id: "handoff-quality",
        dimensionId: "signalCapture",
        prompt: "Hand-offs from program, marketing, events, board, and executive staff preserve the revenue context.",
        evidence: "Relationship history and next action survive the hand-off."
      }
    ]
  },
  {
    id: "qualification",
    title: "Qualification Discipline",
    shortTitle: "Qualify",
    weight: 16,
    description: "How well the pipeline separates real revenue opportunities from hopeful activity.",
    questions: [
      {
        id: "fit-criteria",
        dimensionId: "qualification",
        prompt: "Qualified opportunities meet explicit fit criteria before they enter active pipeline.",
        evidence: "Need, mission alignment, capacity, decision path, timing, and revenue stream are defined."
      },
      {
        id: "amount-confidence",
        dimensionId: "qualification",
        prompt: "Opportunity amounts are based on capacity, precedent, package fit, or funder guidelines.",
        evidence: "Amounts are not just aspirational placeholders."
      },
      {
        id: "decision-maker",
        dimensionId: "qualification",
        prompt: "Decision makers, influencers, and relationship owners are identified early.",
        evidence: "The team knows who can say yes and who can help."
      },
      {
        id: "disqualification",
        dimensionId: "qualification",
        prompt: "Weak-fit opportunities are removed or parked instead of creating false forecast confidence.",
        evidence: "Pipeline reviews include no-go decisions."
      }
    ]
  },
  {
    id: "cultivation",
    title: "Cultivation and Ask Readiness",
    shortTitle: "Cultivate",
    weight: 18,
    description: "How consistently the team advances qualified relationships toward a clear ask.",
    questions: [
      {
        id: "next-step-coverage",
        dimensionId: "cultivation",
        prompt: "Active opportunities have a next step, due date, owner, amount, and expected ask or proposal date.",
        evidence: "No opportunity depends on memory or vague follow-up."
      },
      {
        id: "relationship-plan",
        dimensionId: "cultivation",
        prompt: "Major donor, grantmaker, corporate, and partner relationships have a documented cultivation plan.",
        evidence: "Touches are tied to a specific movement in the revenue journey."
      },
      {
        id: "ask-package",
        dimensionId: "cultivation",
        prompt: "Asks, proposals, sponsorship packages, and grant submissions are matched to funder motivation.",
        evidence: "Messaging connects mission impact, credibility, amount, timing, and recognition or reporting needs."
      },
      {
        id: "board-leverage",
        dimensionId: "cultivation",
        prompt: "Board and executive relationships are intentionally mapped to pipeline movement.",
        evidence: "Introductions, follow-ups, and influence are tracked against opportunities."
      }
    ]
  },
  {
    id: "forecast",
    title: "Forecast Control",
    shortTitle: "Forecast",
    weight: 18,
    description: "How clearly leadership can trust what is expected to close, when, and why.",
    questions: [
      {
        id: "stage-definitions",
        dimensionId: "forecast",
        prompt: "Pipeline stages have clear entry and exit criteria from lead through received cash.",
        evidence: "Staff apply the same stage logic across grants, gifts, sponsorships, and earned revenue."
      },
      {
        id: "probability-logic",
        dimensionId: "forecast",
        prompt: "Forecast probability reflects evidence quality, decision path, deadline, and relationship strength.",
        evidence: "Probability is not a generic stage percentage."
      },
      {
        id: "aging-review",
        dimensionId: "forecast",
        prompt: "Aging opportunities are reviewed and either advanced, re-scoped, parked, or removed.",
        evidence: "Stale pipeline does not inflate the forecast."
      },
      {
        id: "leadership-view",
        dimensionId: "forecast",
        prompt: "Leadership has a current view of best case, likely case, and risk-adjusted revenue.",
        evidence: "Forecast reviews connect pipeline, cash timing, and budget decisions."
      }
    ]
  },
  {
    id: "cashRealization",
    title: "Cash Realization",
    shortTitle: "Cash",
    weight: 20,
    description: "How reliably commitments turn into received money without preventable delay.",
    questions: [
      {
        id: "pledge-to-cash",
        dimensionId: "cashRealization",
        prompt: "Pledges, awards, sponsorship commitments, invoices, and payment terms are tracked through receipt.",
        evidence: "Committed revenue has an owner, expected date, follow-up plan, and status."
      },
      {
        id: "finance-handoff",
        dimensionId: "cashRealization",
        prompt: "Development, programs, and finance reconcile committed, invoiced, restricted, and received revenue.",
        evidence: "Teams do not maintain conflicting versions of expected cash."
      },
      {
        id: "grant-compliance",
        dimensionId: "cashRealization",
        prompt: "Grant reporting, documentation, and restricted fund requirements are visible before cash is at risk.",
        evidence: "Compliance work is not discovered after an award or payment delay."
      },
      {
        id: "collections-rhythm",
        dimensionId: "cashRealization",
        prompt: "Past-due commitments and receivables are worked through a regular follow-up rhythm.",
        evidence: "Payment delays are surfaced early enough to protect the cash plan."
      }
    ]
  },
  {
    id: "renewal",
    title: "Renewal and Expansion Readiness",
    shortTitle: "Renewal",
    weight: 14,
    description: "How well stewardship protects repeat revenue and future expansion.",
    questions: [
      {
        id: "stewardship-calendar",
        dimensionId: "renewal",
        prompt: "Stewardship, reporting, recognition, and impact updates are planned before renewal season.",
        evidence: "Renewal does not depend on a last-minute appeal."
      },
      {
        id: "renewal-owner",
        dimensionId: "renewal",
        prompt: "Renewal owners and next ask timing are assigned for donors, funders, sponsors, and earned revenue accounts.",
        evidence: "Repeat revenue has the same operational discipline as new pipeline."
      },
      {
        id: "impact-feedback",
        dimensionId: "renewal",
        prompt: "Impact, program outcomes, and relationship feedback are captured in a way that supports renewal.",
        evidence: "The team can connect revenue back to outcomes and funder motivation."
      },
      {
        id: "expansion-path",
        dimensionId: "renewal",
        prompt: "The team identifies upgrade, multi-year, cross-program, or sponsorship expansion opportunities.",
        evidence: "Successful relationships are not treated as one-time transactions."
      }
    ]
  }
];

export const allQuestions = dimensions.flatMap((dimension) => dimension.questions);

export const emptyProfile: ProfileInput = {
  orgName: "",
  primaryRevenueStream: "Mixed revenue",
  crmSystem: "",
  annualGoal: "",
  cashReceivedYtd: "",
  openPipeline: "",
  committedNotReceived: "",
  overdueCommitments: "",
  noNextStepPercent: ""
};

export const emptyResponses = allQuestions.reduce<Record<string, number>>((responses, question) => {
  responses[question.id] = 0;
  return responses;
}, {});

function toNumber(value: string) {
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getLabel(total: number) {
  if (total >= 85) return "Lead-to-cash engine";
  if (total >= 70) return "Managed revenue pipeline";
  if (total >= 55) return "Fragile but fixable";
  if (total >= 40) return "High leakage risk";
  return "Uncontrolled pipeline";
}

function getRecommendations(bottleneck: DimensionId, lowScores: DimensionScore[]) {
  const recommendationsByDimension: Record<DimensionId, string> = {
    signalCapture: "Create one intake path for all revenue signals with source, owner, amount range, revenue stream, and first-response deadline.",
    qualification: "Define qualification criteria that separate real opportunities from hopeful activity, then remove weak-fit items from active forecast.",
    cultivation: "Require every active opportunity to have an owner, next step, due date, expected ask date, and relationship plan.",
    forecast: "Rebuild stages around evidence, not optimism: lead, qualified, cultivation, ask or proposal, committed, invoiced or awarded, cash received, renewal.",
    cashRealization: "Run a weekly pledge-to-cash review across development and finance for committed, invoiced, restricted, overdue, and received revenue.",
    renewal: "Build a stewardship calendar tied to renewal timing, impact reporting, relationship owner, and next ask strategy."
  };

  const ordered = [
    recommendationsByDimension[bottleneck],
    ...lowScores.map((score) => recommendationsByDimension[score.id])
  ];

  return Array.from(new Set(ordered)).slice(0, 4);
}

export function scoreAssessment(profile: ProfileInput, responses: Record<string, number>): AssessmentResult {
  const dimensionScores = dimensions.map((dimension) => {
    const totalRaw = dimension.questions.reduce((sum, question) => sum + clamp(responses[question.id] ?? 0, 0, 4), 0);
    const score = Math.round((totalRaw / (dimension.questions.length * 4)) * 100);
    return {
      id: dimension.id,
      title: dimension.title,
      shortTitle: dimension.shortTitle,
      score,
      weightedPoints: Math.round((score / 100) * dimension.weight),
      weight: dimension.weight,
      description: dimension.description
    };
  });

  const total = clamp(
    dimensionScores.reduce((sum, dimension) => sum + dimension.weightedPoints, 0),
    0,
    100
  );
  const label = getLabel(total);
  const findScore = (id: DimensionId) => dimensionScores.find((dimension) => dimension.id === id)?.score ?? 0;
  const blendedConfidence =
    (findScore("qualification") * 0.24 +
      findScore("cultivation") * 0.22 +
      findScore("forecast") * 0.26 +
      findScore("cashRealization") * 0.28) /
    100;
  const openPipeline = toNumber(profile.openPipeline);
  const committedNotReceived = toNumber(profile.committedNotReceived);
  const overdueCommitments = toNumber(profile.overdueCommitments);
  const noNextStepPercent = clamp(toNumber(profile.noNextStepPercent), 0, 100);
  const annualGoal = toNumber(profile.annualGoal);
  const cashReceivedYtd = toNumber(profile.cashReceivedYtd);
  const confidenceWeightedPipeline = Math.round(openPipeline * (0.25 + blendedConfidence * 0.75));
  const cashRiskRate = clamp(
    0.1 + (100 - findScore("cashRealization")) / 180 + noNextStepPercent / 420 + (overdueCommitments > 0 ? 0.08 : 0),
    0.08,
    0.85
  );
  const cashAtRisk = Math.round(committedNotReceived * cashRiskRate + openPipeline * clamp((100 - total) / 650, 0, 0.2));
  const nextStepGap = Math.round(openPipeline * (noNextStepPercent / 100));
  const goalCoverage = annualGoal > 0 ? clamp((cashReceivedYtd + confidenceWeightedPipeline) / annualGoal, 0, 2) : null;

  const leakageMap: LeakageStage[] = [
    {
      stage: "Lead -> Qualified",
      score: Math.round((findScore("signalCapture") + findScore("qualification")) / 2),
      risk: 100 - Math.round((findScore("signalCapture") + findScore("qualification")) / 2),
      diagnosis: "Revenue signals may enter the system without enough evidence to prioritize."
    },
    {
      stage: "Qualified -> Ask",
      score: Math.round((findScore("qualification") + findScore("cultivation")) / 2),
      risk: 100 - Math.round((findScore("qualification") + findScore("cultivation")) / 2),
      diagnosis: "Qualified opportunities may stall before a clear ask, proposal, or package."
    },
    {
      stage: "Ask -> Commit",
      score: Math.round((findScore("cultivation") + findScore("forecast")) / 2),
      risk: 100 - Math.round((findScore("cultivation") + findScore("forecast")) / 2),
      diagnosis: "Forecast confidence may be inflated by weak stage evidence or stale activity."
    },
    {
      stage: "Commit -> Cash",
      score: Math.round((findScore("forecast") + findScore("cashRealization")) / 2),
      risk: 100 - Math.round((findScore("forecast") + findScore("cashRealization")) / 2),
      diagnosis: "Committed revenue may be exposed to pledge, invoice, award, or finance hand-off delays."
    },
    {
      stage: "Cash -> Renewal",
      score: Math.round((findScore("cashRealization") + findScore("renewal")) / 2),
      risk: 100 - Math.round((findScore("cashRealization") + findScore("renewal")) / 2),
      diagnosis: "Received revenue may not reliably turn into repeat or expanded support."
    }
  ].sort((a, b) => b.risk - a.risk);

  const bottleneck = [...dimensionScores].sort((a, b) => a.score - b.score)[0];
  const lowScores = [...dimensionScores].filter((dimension) => dimension.score < 65).sort((a, b) => a.score - b.score);
  const recommendations = getRecommendations(bottleneck.id, lowScores);
  const orgName = profile.orgName.trim() || "This organization";
  const primaryLeak = leakageMap[0];
  const summary = `${orgName} scores ${total}/100 on the FitProof Revenue Pipeline Effectiveness Index (${label}). The primary leakage risk is ${primaryLeak.stage.toLowerCase()}, and the current confidence-weighted pipeline is ${formatCurrency(confidenceWeightedPipeline)}.`;

  return {
    total,
    label,
    confidenceWeightedPipeline,
    cashAtRisk,
    nextStepGap,
    goalCoverage,
    dimensionScores,
    leakageMap,
    bottleneck,
    recommendations,
    summary
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
