export type DomainId = "context" | "systems" | "process" | "staffing" | "knowledge" | "visibility" | "sustainability";

export type QuestionType = "single" | "multi" | "text" | "systems-map";

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
  helperText?: string;
  helpText?: string;
  allowOther?: boolean;
  optional?: boolean;
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

export type SystemCategory = "fundraising" | "crm" | "finance" | "reporting" | "operations";

export type SystemMappingResponse = {
  tools?: Partial<Record<SystemCategory, string | string[]>>;
  otherTools?: Partial<Record<SystemCategory, string>>;
  integration?: string;
  reportConfidence?: string;
};

export type Responses = Record<string, string | string[] | SystemMappingResponse>;

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
  operationalIntelligence?: import("@/lib/operational-intelligence/types").OperationalIntelligenceReport;
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

export const systemCategories: Array<{ id: SystemCategory; label: string; options: string[] }> = [
  {
    id: "fundraising",
    label: "Fundraising",
    options: ["Blackbaud Raiser’s Edge NXT", "Salesforce Nonprofit Cloud / NPSP", "Bloomerang", "DonorPerfect", "Neon CRM", "Classy", "Givebutter", "None", "I don't know", "Other"]
  },
  {
    id: "crm",
    label: "CRM",
    options: ["Salesforce", "Microsoft Dynamics 365", "HubSpot", "Blackbaud CRM / Raiser’s Edge NXT", "Neon CRM", "Bloomerang", "DonorPerfect", "None", "I don't know", "Other"]
  },
  {
    id: "finance",
    label: "Finance",
    options: ["QuickBooks", "Sage Intacct", "Blackbaud Financial Edge NXT", "MIP Fund Accounting", "NetSuite", "Xero", "Aplos", "None", "I don't know", "Other"]
  },
  {
    id: "reporting",
    label: "Reporting",
    options: ["Excel / Google Sheets", "Power BI", "Tableau", "Looker Studio", "Salesforce Reports / Dashboards", "Blackbaud reporting", "Custom data warehouse / BI tool", "None", "I don't know", "Other"]
  },
  {
    id: "operations",
    label: "Operations",
    options: ["Asana", "Monday.com", "Smartsheet", "Airtable", "ClickUp", "Jira", "Microsoft Planner / Teams", "None", "I don't know", "Other"]
  }
];

export const integrationOptions: AnswerOption[] = [
  { label: "Systems share data automatically", risk: 0 },
  { label: "Some systems share data automatically, but manual work remains", risk: 1 },
  { label: "Systems are connected mostly through manual exports/imports", risk: 3 },
  { label: "Systems do not share data", risk: 4 },
  { label: "I don't know", risk: 2 }
];

export const reportingConfidenceOptions: AnswerOption[] = [
  { label: "Extremely confident", risk: 0 },
  { label: "Very confident", risk: 1 },
  { label: "Somewhat confident", risk: 2 },
  { label: "Slightly confident", risk: 3 },
  { label: "Not confident at all", risk: 4 },
  { label: "I don't know", risk: 2 }
];

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
  { id: "systems", title: "Systems & Infrastructure", shortTitle: "Systems", weight: 18, purpose: "Integration, data reliability, system fragmentation, and manual workarounds." },
  { id: "process", title: "Process & Workflow Stability", shortTitle: "Process", weight: 16, purpose: "Documentation, handoffs, repeatability, and workflow scalability." },
  { id: "staffing", title: "Staffing Capacity Indicators", shortTitle: "Staffing", weight: 16, purpose: "Overtime, firefighting, bottlenecks, responsiveness, role coverage, and turnover." },
  { id: "knowledge", title: "Knowledge Infrastructure", shortTitle: "Knowledge", weight: 12, purpose: "Repository reliability, documentation access, SOP currency, and onboarding readiness." },
  { id: "visibility", title: "Visibility & Decision-Making", shortTitle: "Visibility", weight: 16, purpose: "Dashboards, KPI confidence, reporting consistency, forecasting, and board reporting." },
  { id: "sustainability", title: "Sustainability & Mission Strain", shortTitle: "Mission Strain", weight: 22, purpose: "Demand pressure, program cuts, staffing gaps, restructuring risk, growth confidence, and mission impact." }
];

const baseQuestions: Question[] = [
  {
    id: "core-systems",
    domainId: "systems",
    prompt: "Which tools support your core systems, and how well do they work together?",
    type: "systems-map",
    helperText: "Select the main tool in each category, then answer the integration and reporting-confidence questions below.",
    helpText: "This maps the tools your organization relies on and whether they work together. Select all tools used in each category. The score is based on integration and report confidence, not on whether a specific vendor is good or bad."
  },
  { id: "manual-workarounds", domainId: "systems", prompt: "How often do teams rely on spreadsheets or manual workarounds outside core systems?", type: "single", options: frequency },
  { id: "performance-view", domainId: "systems", prompt: "How difficult is it to obtain a complete view of performance across departments?", type: "single", options: easePositive },
  { id: "workflow-friction", domainId: "process", prompt: "Which major operational workflows create the most friction for your team? Select all that apply.", type: "multi", allowOther: true, helperText: "Examples include grant reporting, donor gift processing, client intake, referral management, program enrollment, service documentation, billing/reimbursement, board reporting, financial close, HR onboarding, or cross-department handoffs.", options: [{ label: "Grant reporting", risk: 1 }, { label: "Donor gift processing", risk: 1 }, { label: "Client intake", risk: 1 }, { label: "Referral management", risk: 1 }, { label: "Program enrollment", risk: 1 }, { label: "Service documentation", risk: 1 }, { label: "Billing / reimbursement", risk: 1 }, { label: "Board reporting", risk: 1 }, { label: "Financial close", risk: 1 }, { label: "HR onboarding", risk: 1 }, { label: "Cross-department handoffs", risk: 1 }, { label: "Other", risk: 1 }] },
  { id: "workflow-docs", domainId: "process", prompt: "Major operational workflows are formally documented.", type: "single", options: [{ label: "Fully", risk: 0 }, { label: "Mostly", risk: 1 }, { label: "Partially", risk: 2 }, { label: "Minimally", risk: 3 }, { label: "Not documented", risk: 4 }] },
  { id: "workflow-consistency", domainId: "process", prompt: "Workflows are consistent across teams and programs.", type: "single", options: agreementPositive },
  { id: "handoff-breakdowns", domainId: "process", prompt: "How often do handoffs break down between departments?", type: "single", options: frequency },
  { id: "manual-reporting", domainId: "process", prompt: "Across the team members involved in reporting, finance, fundraising, programs, or operations, approximately how many total staff hours per month are spent on manual reporting, spreadsheet cleanup, or duplicate data entry?", type: "single", options: [{ label: "Less than 5 hours/month", risk: 0 }, { label: "5–15 hours/month", risk: 1 }, { label: "16–40 hours/month", risk: 2 }, { label: "41–80 hours/month", risk: 3 }, { label: "More than 80 hours/month", risk: 4 }, { label: "I don't know", risk: 2 }], helpText: "Estimate the total time across everyone involved, not just one person. Include copying data between systems, cleaning spreadsheets, reconciling reports, re-entering information, and manually preparing recurring reports." },
  { id: "scale-25", domainId: "process", prompt: "If demand increased by 25%, current operational processes could scale effectively.", type: "single", options: agreementPositive },
  { id: "overtime", domainId: "staffing", prompt: "How frequently are employees working overtime?", type: "single", options: frequency },
  { id: "firefighting", domainId: "staffing", prompt: "How often are leaders or teams operating in firefighting mode rather than executing planned work?", type: "single", options: frequency },
  { id: "bottlenecks", domainId: "staffing", prompt: "How frequently do bottlenecks delay reporting, approvals, onboarding, fundraising, or service delivery?", type: "single", options: frequency },
  { id: "strategic-delays", domainId: "staffing", prompt: "How often are strategic initiatives delayed because operational workload consumes available capacity?", type: "single", options: frequency },
  { id: "demand-response", domainId: "staffing", prompt: "How effectively can the organization respond to sudden increases in operational or service demand?", type: "single", options: [{ label: "Very effectively", risk: 0 }, { label: "Effectively", risk: 1 }, { label: "Adequately", risk: 2 }, { label: "With difficulty", risk: 3 }, { label: "Unable", risk: 4 }] },
  { id: "role-coverage", domainId: "staffing", prompt: "How often are employees required to cover multiple operational roles for extended periods?", type: "single", options: frequency },
  { id: "turnover-trend", domainId: "staffing", prompt: "Over the past 12 months, how has employee turnover changed?", type: "single", options: [{ label: "Increased significantly", risk: 4 }, { label: "Increased somewhat", risk: 3 }, { label: "Stable", risk: 1 }, { label: "Decreased", risk: 0 }, { label: "I don't know", risk: 2 }] },
  { id: "knowledge-storage", domainId: "knowledge", prompt: "How much critical organizational knowledge lives in the heads of specific employees?", type: "single", options: [{ label: "Very little; it is documented centrally", risk: 0 }, { label: "Some, but most is documented", risk: 1 }, { label: "A moderate amount", risk: 2 }, { label: "A significant amount", risk: 3 }, { label: "Most critical knowledge lives with specific people", risk: 4 }] },
  { id: "documentation-access", domainId: "knowledge", prompt: "How easy is it for employees to locate accurate process documentation or operational guidance?", type: "single", options: easePositive },
  { id: "sop-currency", domainId: "knowledge", prompt: "How frequently are operational documents, SOPs, or workflow documentation updated?", type: "single", options: [{ label: "Continuously", risk: 0 }, { label: "Regularly", risk: 1 }, { label: "Occasionally", risk: 2 }, { label: "Rarely", risk: 3 }, { label: "Almost never", risk: 4 }] },
  { id: "change-communication", domainId: "knowledge", prompt: "When processes change, how consistently are those changes documented and communicated?", type: "single", options: [{ label: "Always", risk: 0 }, { label: "Usually", risk: 1 }, { label: "Occasionally", risk: 2 }, { label: "Rarely", risk: 3 }, { label: "Never", risk: 4 }] },
  { id: "dashboard-access", domainId: "visibility", prompt: "Leadership has timely access to reliable dashboards and KPIs.", type: "single", options: agreementPositive },
  { id: "conflicting-metrics", domainId: "visibility", prompt: "How often do departments report conflicting numbers or metrics?", type: "single", options: frequency },
  { id: "forecast-confidence", domainId: "visibility", prompt: "Leadership can forecast revenue, cash flow, or service capacity with confidence.", type: "single", options: agreementPositive },
  { id: "board-reporting", domainId: "visibility", prompt: "Approximately how many staff hours does it take each month or board cycle to produce board-ready reporting?", type: "single", options: [{ label: "Less than 5 hours", risk: 0 }, { label: "5–15 hours", risk: 1 }, { label: "16–40 hours", risk: 2 }, { label: "41–80 hours", risk: 3 }, { label: "More than 80 hours", risk: 4 }, { label: "I don't know", risk: 2 }], helpText: "This asks how much effort it takes to prepare accurate, leadership-ready reports for your board. Include pulling data, cleaning spreadsheets, reconciling numbers, creating charts, and checking accuracy." },
  { id: "board-reporting-barriers", domainId: "visibility", prompt: "What makes board reporting difficult? Select all that apply.", type: "multi", allowOther: true, options: [{ label: "Data lives in multiple systems", risk: 1 }, { label: "Reports require manual spreadsheet work", risk: 1 }, { label: "Definitions are inconsistent across teams", risk: 1 }, { label: "Reports require finance/program/fundraising reconciliation", risk: 1 }, { label: "We lack dashboard or BI tools", risk: 1 }, { label: "Accuracy checks take significant time", risk: 1 }, { label: "Other", risk: 1 }] },
  { id: "early-warning", domainId: "visibility", prompt: "Leaders have enough visibility to identify problems before they become urgent.", type: "single", options: agreementPositive },
  { id: "demand-change", domainId: "sustainability", prompt: "How has demand for your services changed over the past 12 months?", type: "single", options: [{ label: "Increased significantly", risk: 4 }, { label: "Increased somewhat", risk: 3 }, { label: "Stayed about the same", risk: 1 }, { label: "Decreased somewhat", risk: 2 }, { label: "Decreased significantly", risk: 3 }, { label: "I don't know", risk: 2 }] },
  { id: "program-cuts", domainId: "sustainability", prompt: "Have you delayed, reduced, or cut programs due to operational or financial strain?", type: "single", options: [{ label: "Frequently", risk: 4 }, { label: "Occasionally", risk: 3 }, { label: "Rarely", risk: 1 }, { label: "Never", risk: 0 }] },
  { id: "staffing-service-quality", domainId: "sustainability", prompt: "Are staffing gaps affecting service quality or responsiveness?", type: "single", options: frequency },
  { id: "growth-confidence", domainId: "sustainability", prompt: "Current infrastructure can support future growth.", type: "single", options: agreementPositive },
  { id: "biggest-constraint", domainId: "sustainability", prompt: "What additional operational context would help explain your results?", type: "text", optional: true, helperText: "Optional: include only context that would be useful for interpreting the report.", helpText: "Use this only if there is specific context the assessment did not capture. Blank, unsure, none, or low-information answers are ignored in scoring and narrative." }
];

const questionHelpText: Record<string, string> = {
  "core-systems": "Select every system your team regularly uses in each area. Include tools used by different departments, even if they overlap. This matters because disconnected tools can create manual reporting and slow decisions. Do not include tools that are only used rarely.",
  "manual-workarounds": "This asks how often people work outside the official systems to get work done. Include spreadsheets, side databases, copied reports, and manual trackers. Frequent workarounds often mean the systems are not supporting the work well.",
  "performance-view": "Think about how hard it is for leaders to see performance across programs, fundraising, finance, and operations. Include time spent asking different teams for updates or reconciling conflicting reports. Easier access usually means stronger decision visibility.",
  "workflow-friction": "Select the workflows that most often slow people down, create rework, or cause handoff problems. Include recurring processes, not one-time headaches. This helps identify where operational fixes would have the most practical impact.",
  "workflow-docs": "This asks whether key workflows are written down clearly enough for someone else to follow. Include step-by-step procedures, owners, templates, and timing. Do not count informal explanations that only live in conversation.",
  "workflow-consistency": "Answer based on whether teams perform the same work in the same way. If each program, site, or department has its own version of a process, choose a lower consistency option. Consistency supports scale and quality.",
  "handoff-breakdowns": "Consider moments where work passes from one person or team to another. Include missed approvals, incomplete information, delayed follow-up, or unclear ownership. Frequent breakdowns are a sign that process roles may need clarification.",
  "manual-reporting": "Estimate total monthly hours across everyone involved, not just one person. Include copying data, cleaning spreadsheets, reconciling numbers, re-entering information, and building recurring reports. A rough estimate is enough.",
  "scale-25": "Imagine service demand or workload rose by about one quarter. Answer based on whether current processes could handle that without heroic effort, confusion, or major delays. This helps estimate scalability.",
  "overtime": "Answer based on how often staff need extra hours to keep operations moving. Include recurring evening, weekend, or catch-up work. Do not include occasional seasonal pushes if they are planned and manageable.",
  "firefighting": "This asks how often teams are reacting to urgent issues instead of working from a plan. Include last-minute fixes, crisis response, and constant escalations. Frequent firefighting usually reduces leadership bandwidth.",
  "bottlenecks": "Think about places where work waits on one person, approval, report, or system. Include delays in onboarding, fundraising, reporting, service delivery, or decisions. Bottlenecks limit execution capacity.",
  "strategic-delays": "Consider whether important projects are postponed because day-to-day workload takes over. Include technology upgrades, process improvements, growth initiatives, or partnership work. Delays can show that operations are consuming strategic capacity.",
  "demand-response": "Answer based on how well the organization can respond when demand rises suddenly. Include staffing, systems, space, program capacity, and leadership attention. This is about operational readiness, not mission commitment.",
  "role-coverage": "This asks whether people cover multiple roles for long stretches because of vacancies, absences, or unclear staffing. Include coverage that affects quality, timeliness, or burnout risk. Short planned backup coverage is less concerning.",
  "turnover-trend": "Answer based on what you know about employee exits over the past year. If you do not have reliable information, choose I don’t know. The goal is to understand staffing stability, not to assign blame.",
  "knowledge-storage": "Think about where critical know-how lives. If operations depend on a few people remembering how things work, choose a higher-risk option. Include procedures, funder rules, system knowledge, contacts, and reporting steps.",
  "documentation-access": "This asks how easily staff can find accurate instructions when they need them. Include shared drives, knowledge bases, SOPs, templates, and system guides. Hard-to-find documentation slows onboarding and daily execution.",
  "sop-currency": "Answer based on whether written procedures stay current when systems, funder rules, staffing, or programs change. Outdated documentation can be worse than no documentation because it creates false confidence.",
  "change-communication": "Consider how process changes are shared after decisions are made. Include whether changes are documented, announced, and reinforced. Strong communication prevents teams from using different versions of the same process.",
  "dashboard-access": "This asks whether leaders can see timely, reliable indicators without waiting for manual report-building. Include dashboards, KPI reports, and recurring summaries. The key question is whether the information is trusted and current.",
  "conflicting-metrics": "Think about how often teams report different numbers for the same thing. Include revenue, service counts, outcomes, staffing, or pipeline metrics. Conflicting metrics weaken trust and slow decisions.",
  "forecast-confidence": "Answer based on how confidently leaders can anticipate revenue, cash flow, demand, or capacity. Include whether forecasts are based on reliable data or mostly judgment calls. Forecasting helps leaders act before problems become urgent.",
  "board-reporting": "Estimate the staff time needed to produce board-ready reports each month or board cycle. Include pulling data, cleaning files, reconciling numbers, creating charts, and checking accuracy.",
  "board-reporting-barriers": "Select the issues that make board reporting harder than it should be. Include data location, definitions, reconciliation, manual spreadsheet work, dashboards, and accuracy checks. Choose only recurring barriers.",
  "early-warning": "This asks whether leaders can spot problems early enough to act. Include financial, staffing, service, compliance, and reporting signals. Early warning visibility reduces surprises and reactive decision-making.",
  "demand-change": "Answer based on service demand over the last year. Include referrals, waitlists, caseload, program participation, inquiries, or other mission-relevant demand signals. If you do not know, choose I don’t know.",
  "program-cuts": "This asks whether operational or financial strain has forced program delays, reductions, or cuts. Include service limits, postponed launches, reduced hours, or narrowed eligibility. Do not include normal strategic pruning.",
  "staffing-service-quality": "Consider whether staffing gaps are affecting response time, service quality, documentation, follow-up, or client experience. This is about operational impact, not individual effort or commitment.",
  "growth-confidence": "Answer based on whether current systems, staffing, reporting, and processes could support future growth. Include new programs, new funding, more clients, or more locations. Growth without infrastructure can increase strain.",
  "biggest-constraint": "Use this only for specific context that would help interpret the report. Include concrete barriers, timing, or operating realities the questions missed. Leave blank if there is nothing meaningful to add."
};

export const questions: Question[] = baseQuestions.map((question) => ({
  ...question,
  helpText: question.helpText || questionHelpText[question.id]
}));

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
  if (!answer) return null;

  if (question.type === "systems-map") {
    return riskForSystemMapping(answer);
  }

  if (!question.options) return null;

  if (answer === unknownOption.label || (Array.isArray(answer) && answer.includes(unknownOption.label))) {
    return unknownOption.risk;
  }

  if (question.type === "multi") {
    return Math.min(4, Math.max(0, (Array.isArray(answer) ? answer.length : 1) - 1));
  }

  return getQuestionOptions(question).find((option) => option.label === answer)?.risk ?? null;
}

function riskForSystemMapping(answer: Responses[string]) {
  if (!isSystemMappingResponse(answer)) return null;
  const risks: number[] = [];
  const integrationRisk = integrationOptions.find((option) => option.label === answer.integration)?.risk;
  const confidenceRisk = reportingConfidenceOptions.find((option) => option.label === answer.reportConfidence)?.risk;
  if (typeof integrationRisk === "number") risks.push(integrationRisk);
  if (typeof confidenceRisk === "number") risks.push(confidenceRisk);

  const selectedTools = systemCategories.flatMap((category) => selectedSystemTools(answer, category.id));
  const noneCount = selectedTools.filter((tool) => tool === "None").length;
  const unknownCount = selectedTools.filter((tool) => tool === "I don't know").length;
  if (noneCount) risks.push(Math.min(4, noneCount));
  if (unknownCount) risks.push(Math.min(3, unknownCount));

  return risks.length ? risks.reduce((sum, risk) => sum + risk, 0) / risks.length : null;
}

export function isSystemMappingResponse(value: Responses[string]): value is SystemMappingResponse {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
  return typeof value === "string" && isMeaningfulActionableText(value) ? value.trim() : "";
}

export function isMeaningfulActionableText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[.'"]/g, "");
  if (!normalized) return false;
  if (normalized.length < 12) return false;
  return !/^(i\s*don'?t know|dont know|not sure|unsure|n\/a|na|none|nothing|no|nope|unknown|not applicable|not at this time)$/i.test(normalized);
}

export function getSystemMappingSummary(responses: Responses) {
  const answer = responses["core-systems"];
  if (!isSystemMappingResponse(answer)) return "";
  const tools = systemCategories
    .map((category) => {
      const selected = selectedSystemTools(answer, category.id);
      if (!selected.length || selected.includes("I don't know")) return "";
      const labels = selected
        .map((tool) => (tool === "Other" ? answer.otherTools?.[category.id] : tool))
        .filter(Boolean);
      return labels.length ? `${category.label}: ${labels.join(", ")}` : "";
    })
    .filter(Boolean);
  const details = [
    tools.length ? `Selected systems include ${tools.join("; ")}.` : "",
    answer.integration ? `Integration pattern: ${answer.integration}.` : "",
    answer.reportConfidence ? `Leadership report confidence: ${answer.reportConfidence}.` : ""
  ];
  return details.filter(Boolean).join(" ");
}

export function selectedSystemTools(answer: SystemMappingResponse, category: SystemCategory) {
  const selected = answer.tools?.[category];
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}
