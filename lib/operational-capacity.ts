export type DomainId = "context" | "systems" | "process" | "staffing" | "knowledge" | "visibility" | "sustainability";

export type QuestionType = "single" | "multi" | "text";

export type AnswerOption = {
  label: string;
  risk: number;
};

export type Question = {
  id: string;
  domainId: DomainId;
  prompt: string;
  type: QuestionType;
  options?: AnswerOption[];
};

export type Domain = {
  id: DomainId;
  title: string;
  shortTitle: string;
  weight: number;
  purpose: string;
};

export type Profile = {
  organization: string;
  websiteUrl: string;
};

export type Lead = {
  email: string;
};

export type Responses = Record<string, string | string[]>;

export type DomainScore = Domain & {
  risk: number;
  weightedRisk: number;
  answered: number;
};

export type Stage = {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  min: number;
  max: number;
  interpretation: string;
};

export type AssessmentResult = {
  riskScore: number;
  stage: Stage;
  domainScores: DomainScore[];
  topRiskDomains: DomainScore[];
  flags: string[];
};

export type PrimaryStrainDriver = {
  category: string;
  strain: string;
  evidence: string;
  whyItMatters: string;
  consequence: string;
};

export type RecommendedEngagement = {
  recommendedOffering: string;
  whyThisOfferingFits: string;
  primaryObjectives: string[];
  initialWorkplan: string[];
  expectedOutcomes: string[];
  suggestedTimeline: string;
  whyNow: string;
};

export type GeneratedExecutiveReport = {
  generated: boolean;
  fallbackReason?: string;
  executiveSummary: string;
  organizationSnapshot: string;
  strainDiagnosis: string;
  missionImplications: string;
  financialAnalysis?: string;
  staffingCapacityAnalysis?: string;
  strategicSignals?: string;
  primaryStrainDrivers?: PrimaryStrainDriver[];
  topRisks: string[];
  recommendations: string[];
  fitProofEngagement: string;
  recommendedEngagement?: RecommendedEngagement;
  nextSteps?: string[];
  publicSignals: string[];
  sources: { title: string; url: string }[];
};

const frequency = [
  { label: "Constantly", risk: 4 },
  { label: "Usually", risk: 3 },
  { label: "Occasionally", risk: 2 },
  { label: "Rarely", risk: 1 },
  { label: "Never", risk: 0 }
];

const agreementPositive = [
  { label: "Strongly disagree", risk: 4 },
  { label: "Disagree", risk: 3 },
  { label: "Mixed", risk: 2 },
  { label: "Agree", risk: 1 },
  { label: "Strongly agree", risk: 0 }
];

const easePositive = [
  { label: "Extremely difficult", risk: 4 },
  { label: "Difficult", risk: 3 },
  { label: "Moderate", risk: 2 },
  { label: "Easy", risk: 1 },
  { label: "Very easy", risk: 0 }
];

export const domains: Domain[] = [
  { id: "context", title: "Operational Complexity Context", shortTitle: "Context", weight: 10, purpose: "Demand pressure and public financial context pulled from available filings, reports, and website sources." },
  { id: "systems", title: "Systems & Infrastructure", shortTitle: "Systems", weight: 16, purpose: "Integration, data reliability, system fragmentation, and manual workarounds." },
  { id: "process", title: "Process & Workflow Stability", shortTitle: "Process", weight: 14, purpose: "Documentation, handoffs, repeatability, and workflow scalability." },
  { id: "staffing", title: "Staffing Capacity Indicators", shortTitle: "Staffing", weight: 16, purpose: "Overtime, firefighting, bottlenecks, responsiveness, role coverage, and turnover." },
  { id: "knowledge", title: "Knowledge Infrastructure", shortTitle: "Knowledge", weight: 12, purpose: "Repository reliability, documentation access, SOP currency, and onboarding readiness." },
  { id: "visibility", title: "Visibility & Decision-Making", shortTitle: "Visibility", weight: 14, purpose: "Dashboards, KPI confidence, reporting consistency, forecasting, and board reporting." },
  { id: "sustainability", title: "Sustainability & Mission Strain", shortTitle: "Mission Strain", weight: 18, purpose: "Program cuts, staffing gaps, restructuring risk, growth confidence, and mission impact." }
];

export const questions: Question[] = [
  { id: "demand-change", domainId: "context", prompt: "Demand change over the past 12 months", type: "single", options: [{ label: "Increased significantly", risk: 4 }, { label: "Increased moderately", risk: 3 }, { label: "Stayed flat", risk: 1 }, { label: "Decreased moderately", risk: 2 }, { label: "Decreased significantly", risk: 3 }] },
  { id: "core-systems", domainId: "systems", prompt: "How many core systems are used for fundraising, finance, reporting, and operations?", type: "single", options: [{ label: "1-2", risk: 0 }, { label: "3-5", risk: 1 }, { label: "6-10", risk: 3 }, { label: "10+", risk: 4 }] },
  {
    id: "systems-integrated",
    domainId: "systems",
    prompt: "Level of system integration",
    type: "single",
    options: [
      { label: "Everything is integrated", risk: 0 },
      { label: "Many are integrated", risk: 1 },
      { label: "Some are integrated", risk: 2 },
      { label: "Few are integrated", risk: 3 },
      { label: "None are integrated", risk: 4 }
    ]
  },
  { id: "manual-workarounds", domainId: "systems", prompt: "How often do teams rely on spreadsheets or manual workarounds outside core systems?", type: "single", options: frequency },
  {
    id: "data-confidence",
    domainId: "systems",
    prompt: "How confident is leadership in the accuracy and consistency of operational data?",
    type: "single",
    options: [
      { label: "Extremely confident", risk: 0 },
      { label: "Very confident", risk: 1 },
      { label: "Somewhat confident", risk: 2 },
      { label: "Slightly confident", risk: 3 },
      { label: "Not confident at all", risk: 4 }
    ]
  },
  { id: "performance-view", domainId: "systems", prompt: "How difficult is it to obtain a complete view of performance across departments?", type: "single", options: easePositive },
  { id: "workflow-docs", domainId: "process", prompt: "Major operational workflows are formally documented.", type: "single", options: [{ label: "Fully", risk: 0 }, { label: "Mostly", risk: 1 }, { label: "Partially", risk: 2 }, { label: "Minimally", risk: 3 }, { label: "Not documented", risk: 4 }] },
  { id: "workflow-consistency", domainId: "process", prompt: "Workflows are consistent across teams and programs.", type: "single", options: agreementPositive },
  { id: "handoff-breakdowns", domainId: "process", prompt: "How often do handoffs break down between departments?", type: "single", options: frequency },
  { id: "manual-reporting", domainId: "process", prompt: "How much time is spent on manual reporting or duplicate data entry?", type: "single", options: [{ label: "Excessive", risk: 4 }, { label: "Significant", risk: 3 }, { label: "Moderate", risk: 2 }, { label: "Limited", risk: 1 }, { label: "Minimal", risk: 0 }] },
  { id: "scale-25", domainId: "process", prompt: "If demand increased by 25%, current operational processes could scale effectively.", type: "single", options: agreementPositive },
  { id: "overtime", domainId: "staffing", prompt: "How frequently are employees working overtime?", type: "single", options: frequency },
  { id: "firefighting", domainId: "staffing", prompt: "How often are leaders or teams operating in firefighting mode rather than executing planned work?", type: "single", options: frequency },
  { id: "bottlenecks", domainId: "staffing", prompt: "How frequently do bottlenecks delay reporting, approvals, onboarding, fundraising, or service delivery?", type: "single", options: frequency },
  { id: "strategic-delays", domainId: "staffing", prompt: "How often are strategic initiatives delayed because operational workload consumes available capacity?", type: "single", options: frequency },
  { id: "demand-response", domainId: "staffing", prompt: "How effectively can the organization respond to sudden increases in operational or service demand?", type: "single", options: [{ label: "Very effectively", risk: 0 }, { label: "Effectively", risk: 1 }, { label: "Adequately", risk: 2 }, { label: "With difficulty", risk: 3 }, { label: "Unable", risk: 4 }] },
  { id: "role-coverage", domainId: "staffing", prompt: "How often are employees required to cover multiple operational roles for extended periods?", type: "single", options: frequency },
  { id: "turnover-trend", domainId: "staffing", prompt: "Over the past 12 months, how has employee turnover changed?", type: "single", options: [{ label: "Increased significantly", risk: 4 }, { label: "Increased somewhat", risk: 3 }, { label: "Stable", risk: 1 }, { label: "Decreased", risk: 0 }, { label: "I don't know", risk: 2 }] },
  { id: "knowledge-storage", domainId: "knowledge", prompt: "Where is operational knowledge primarily stored?", type: "single", options: [{ label: "Centralized knowledge system", risk: 0 }, { label: "Shared docs", risk: 1 }, { label: "Team files", risk: 2 }, { label: "Individual docs or spreadsheets", risk: 3 }, { label: "Primarily held by individuals", risk: 4 }] },
  { id: "documentation-access", domainId: "knowledge", prompt: "How easy is it for employees to locate accurate process documentation or operational guidance?", type: "single", options: easePositive },
  { id: "sop-currency", domainId: "knowledge", prompt: "How frequently are operational documents, SOPs, or workflow documentation updated?", type: "single", options: [{ label: "Continuously", risk: 0 }, { label: "Regularly", risk: 1 }, { label: "Occasionally", risk: 2 }, { label: "Rarely", risk: 3 }, { label: "Almost never", risk: 4 }] },
  { id: "change-communication", domainId: "knowledge", prompt: "When processes change, how consistently are those changes documented and communicated?", type: "single", options: [{ label: "Always", risk: 0 }, { label: "Usually", risk: 1 }, { label: "Occasionally", risk: 2 }, { label: "Rarely", risk: 3 }, { label: "Never", risk: 4 }] },
  { id: "dashboard-access", domainId: "visibility", prompt: "Leadership has timely access to reliable dashboards and KPIs.", type: "single", options: agreementPositive },
  { id: "conflicting-metrics", domainId: "visibility", prompt: "How often do departments report conflicting numbers or metrics?", type: "single", options: frequency },
  { id: "forecast-confidence", domainId: "visibility", prompt: "Leadership can forecast revenue, cash flow, or service capacity with confidence.", type: "single", options: agreementPositive },
  { id: "board-reporting", domainId: "visibility", prompt: "How difficult is it to produce board-ready reporting?", type: "single", options: easePositive },
  { id: "early-warning", domainId: "visibility", prompt: "Leaders have enough visibility to identify problems before they become urgent.", type: "single", options: agreementPositive },
  { id: "program-cuts", domainId: "sustainability", prompt: "Have you delayed, reduced, or cut programs due to operational or financial strain?", type: "single", options: [{ label: "Frequently", risk: 4 }, { label: "Occasionally", risk: 3 }, { label: "Rarely", risk: 1 }, { label: "Never", risk: 0 }] },
  { id: "staffing-service-quality", domainId: "sustainability", prompt: "Are staffing gaps affecting service quality or responsiveness?", type: "single", options: frequency },
  { id: "restructuring-risk", domainId: "sustainability", prompt: "Are you considering restructuring, merging, or reducing services?", type: "single", options: [{ label: "Yes, actively", risk: 4 }, { label: "Possibly", risk: 3 }, { label: "Discussed informally", risk: 2 }, { label: "No", risk: 0 }] },
  { id: "growth-confidence", domainId: "sustainability", prompt: "Current infrastructure can support future growth.", type: "single", options: agreementPositive },
  { id: "biggest-constraint", domainId: "sustainability", prompt: "What is the single biggest operational constraint facing the organization today?", type: "text" }
];

export const unknownOption: AnswerOption = { label: "I don't know", risk: 2 };

export const stages: Stage[] = [
  { number: 1, name: "Emerging Friction", min: 0, max: 14, interpretation: "Complexity is beginning to create operating friction, but strain signals are still manageable." },
  { number: 2, name: "Operational Dependency", min: 15, max: 29, interpretation: "Individuals are beginning to compensate for gaps in systems, documentation, and process." },
  { number: 3, name: "Capacity Strain", min: 30, max: 44, interpretation: "Operational workload is exceeding sustainable capacity and teams are increasingly reactive." },
  { number: 4, name: "Knowledge Fragmentation", min: 45, max: 59, interpretation: "Documentation, handoffs, and reporting consistency are weakening organizational continuity." },
  { number: 5, name: "Compounding Inefficiency", min: 60, max: 74, interpretation: "Fragmented systems and manual workflows are creating organization-wide drag." },
  { number: 6, name: "Mission Contraction", min: 75, max: 89, interpretation: "Operational strain is beginning to directly affect programs, service capacity, or growth." },
  { number: 7, name: "Organizational Instability", min: 90, max: 100, interpretation: "Infrastructure can no longer reliably support organizational complexity without urgent intervention." }
];

export const stageRecommendations: Record<number, { primary: string; cta: string; actions: string[] }> = {
  1: { primary: "Standardize operating practices before friction compounds.", cta: "Operational Readiness Assessment", actions: ["Document critical workflows", "Define KPI owners", "Clarify process handoffs", "Automate one recurring reporting task", "Review system ownership quarterly"] },
  2: { primary: "Reduce dependency on individual workarounds.", cta: "Revenue Operations Diagnostic", actions: ["Map workflow owners", "Identify revenue and reporting handoffs", "Prioritize fragile processes", "Create backup ownership for critical roles", "Define decision-ready documentation"] },
  3: { primary: "Stabilize the knowledge layer that supports daily execution.", cta: "Knowledge Infrastructure & Process Stabilization Sprint", actions: ["Centralize operating guidance", "Stabilize handoffs", "Refresh outdated SOPs", "Improve onboarding readiness", "Create a change communication standard"] },
  4: { primary: "Stabilize workflow breakdowns before they become organization-wide drag.", cta: "Operational Stabilization & Revenue Process Optimization Engagement", actions: ["Map cross-team workflows", "Eliminate duplicate work", "Integrate fragmented systems", "Rebuild reporting architecture", "Create a dashboard governance model"] },
  5: { primary: "Reduce executive bottlenecks and restore decision throughput.", cta: "Executive Operating System & Decision Infrastructure Engagement", actions: ["Clarify decision rights", "Create an executive operating cadence", "Build board-ready visibility", "Define escalation standards", "Create ownership for cross-functional priorities"] },
  6: { primary: "Move from reactive operations into controlled stabilization.", cta: "Full Operational Turnaround Readiness Engagement", actions: ["Run immediate operational triage", "Stabilize service-critical workflows", "Create board-ready action planning", "Prioritize capacity restoration", "Resolve visibility gaps affecting mission decisions"] },
  7: { primary: "Reset the operating model around mission-critical continuity.", cta: "Mission-Critical Operating Model Reset", actions: ["Stand up executive intervention cadence", "Protect essential services", "Create a restructure support plan", "Triage systems and staffing risks", "Restore urgent capacity before growth work resumes"] }
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskForAnswer(question: Question, responses: Responses) {
  if (question.type === "text") return null;
  const answer = responses[question.id];
  if (!answer || !question.options) return null;

  if (answer === unknownOption.label || (Array.isArray(answer) && answer.includes(unknownOption.label))) {
    return unknownOption.risk;
  }

  if (question.type === "multi") {
    return Math.min(4, Math.max(0, (Array.isArray(answer) ? answer.length : 1) - 1));
  }

  return getQuestionOptions(question).find((option) => option.label === answer)?.risk ?? null;
}

export function getQuestionOptions(question: Question) {
  if (!question.options) return [];
  if (question.options.some((option) => option.label === unknownOption.label)) return question.options;
  return [...question.options, unknownOption];
}

export function scoreAssessment(responses: Responses): AssessmentResult {
  const domainScores = domains.map((domain) => {
    const domainQuestions = questions.filter((question) => question.domainId === domain.id && question.type !== "text");
    const risks = domainQuestions.map((question) => riskForAnswer(question, responses)).filter((risk): risk is number => risk !== null);
    const averageRisk = risks.length ? risks.reduce((sum, risk) => sum + risk, 0) / risks.length : 0;
    const risk = clamp((averageRisk / 4) * 100);

    return {
      ...domain,
      risk,
      weightedRisk: (risk * domain.weight) / 100,
      answered: risks.length
    };
  });

  const baseRisk = clamp(domainScores.reduce((sum, domain) => sum + domain.weightedRisk, 0));
  const flags = getFlags(responses);
  const severeMissionRisk = flags.some((flag) => flag.startsWith("Stage 6 floor"));
  const riskScore = severeMissionRisk ? Math.max(baseRisk, 75) : baseRisk;
  const stage = stages.find((item) => riskScore >= item.min && riskScore <= item.max) ?? stages[6];
  const topRiskDomains = [...domainScores].sort((a, b) => b.risk - a.risk).slice(0, 3);

  return {
    riskScore,
    stage,
    domainScores,
    topRiskDomains,
    flags
  };
}

export function getFlags(responses: Responses) {
  const flags: string[] = [];

  if (responses["restructuring-risk"] === "Yes, actively") {
    flags.push("Stage 6 floor: active restructuring, merger, or service reduction consideration.");
  }

  if (responses["program-cuts"] === "Frequently") {
    flags.push("Stage 6 floor: frequent program cuts due to operational or financial strain.");
  }

  if (responses["turnover-trend"] === "I don't know") {
    flags.push("Reporting visibility flag: turnover trend is unknown.");
  }

  return flags;
}

export function generateExecutiveSummary(profile: Profile, result: AssessmentResult) {
  const org = profile.organization || "The organization";
  const topDomains = result.topRiskDomains.map((domain) => domain.shortTitle).join(", ");

  return `${org} is currently assessed at Stage ${result.stage.number}: ${result.stage.name}, with an operational strain score of ${result.riskScore}/100. The strongest strain signals are concentrated in ${topDomains || "the assessed operating sections"}. ${result.stage.interpretation} The recommended path is to address the highest-strain operating constraints first, then convert those fixes into repeatable systems, ownership, and reporting practices.`;
}

export function generateRisks(result: AssessmentResult) {
  return result.topRiskDomains.map((domain) => {
    if (domain.risk >= 75) return `${domain.title}: urgent strain signal that may affect continuity, service quality, or leadership visibility.`;
    if (domain.risk >= 50) return `${domain.title}: material operating drag that should be addressed before it compounds.`;
    return `${domain.title}: emerging risk area to standardize while the intervention cost is still low.`;
  });
}

export function getOpenConstraint(responses: Responses) {
  const value = responses["biggest-constraint"];
  return typeof value === "string" ? value.trim() : "";
}
