import { AssessmentInput } from "@/lib/scoring";

export type IcpSuggestion = {
  id: string;
  segment: string;
  description: string;
  economicBuyer: string;
  buyingTrigger: string;
  whyItFits: string;
  validationQuestion: string;
  confidence: "High" | "Medium" | "Exploratory";
};

export const icpSuggestionStorageKey = "fitproof.icpSuggestions.v1";

type IcpInput = Pick<
  AssessmentInput,
  | "productDescription"
  | "problemSolved"
  | "currentAlternatives"
  | "economicBuyer"
  | "marketCategory"
  | "geography"
  | "stage"
  | "whyNow"
>;

function hasAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function compact(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function summarizeProblem(value: string, department: string) {
  const domain = department.replace(/\s+teams$/i, "");
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return `the stated ${domain} workflow pain`;
  if (trimmed.length <= 90) return trimmed.replace(/[.?!]$/g, "");
  return `the stated ${domain} workflow pain`;
}

function combineScopeAndProfile(geography: string, companyProfile: string) {
  const scope = geography.trim();
  const profile = companyProfile.trim();
  if (!scope) return profile;

  const normalizedScope = scope.toLowerCase();
  if (normalizedScope.includes("mid-market") && profile.includes("mid-market")) {
    return `${scope} companies with specialized operators`;
  }
  if (normalizedScope.includes("startup") && profile.includes("early-stage")) {
    return scope;
  }
  return `${scope} ${profile}`;
}

function inferBuyer(text: string, fallback: string) {
  if (fallback.trim()) return fallback.trim();
  if (hasAny(text, ["sales", "revenue", "revops", "forecast", "pipeline", "crm"])) return "VP Sales or Head of Revenue Operations";
  if (hasAny(text, ["finance", "cash", "budget", "forecasting", "invoice", "cfo"])) return "CFO or finance operations lead";
  if (hasAny(text, ["security", "compliance", "risk", "audit", "privacy"])) return "Chief Information Security Officer or compliance lead";
  if (hasAny(text, ["support", "ticket", "customer success", "churn", "retention"])) return "VP Customer Success or support operations lead";
  if (hasAny(text, ["hiring", "talent", "recruit", "employee", "hr"])) return "Head of People or talent operations lead";
  if (hasAny(text, ["founder", "startup", "seed", "pre-seed"])) return "Founder or functional owner";
  return "Functional leader who owns the workflow and budget";
}

function inferDepartment(text: string) {
  if (hasAny(text, ["sales", "revenue", "revops", "forecast", "pipeline", "crm"])) return "revenue teams";
  if (hasAny(text, ["finance", "cash", "budget", "forecasting", "invoice"])) return "finance teams";
  if (hasAny(text, ["security", "compliance", "risk", "audit", "privacy"])) return "security and compliance teams";
  if (hasAny(text, ["support", "ticket", "customer success", "churn", "retention"])) return "customer operations teams";
  if (hasAny(text, ["hiring", "talent", "recruit", "employee", "hr"])) return "people teams";
  if (hasAny(text, ["marketing", "campaign", "content", "demand gen", "brand"])) return "marketing teams";
  return "operations teams";
}

function inferCompanyProfile(text: string) {
  if (hasAny(text, ["enterprise", "procurement", "compliance", "audit"])) return "enterprise teams with formal procurement";
  if (hasAny(text, ["mid-market", "scaleup", "salesforce", "revops"])) return "mid-market companies with specialized operators";
  if (hasAny(text, ["seed", "pre-seed", "founder", "startup"])) return "early-stage companies with founder-led buying";
  if (hasAny(text, ["smb", "small business", "owner"])) return "SMBs with owner-led buying";
  return "growing B2B teams with an active operational pain";
}

function inferTrigger(input: IcpInput, text: string) {
  if (input.whyNow.trim()) return input.whyNow.trim();
  if (hasAny(text, ["manual", "spreadsheet", "hours", "waste"])) return "Manual work has become too slow, error-prone, or expensive to sustain.";
  if (hasAny(text, ["risk", "compliance", "audit", "deadline"])) return "A risk event, audit, or executive deadline forces the buyer to act.";
  if (hasAny(text, ["growth", "scale", "pipeline", "forecast"])) return "Growth exposes process gaps that existing tools and spreadsheets cannot handle.";
  return "The buyer is actively comparing tools, services, or internal workarounds to solve the problem now.";
}

export function suggestIcpHypotheses(input: IcpInput): IcpSuggestion[] {
  const text = [
    input.productDescription,
    input.problemSolved,
    input.currentAlternatives,
    input.marketCategory,
    input.whyNow
  ].join(" ");
  const category = compact(input.marketCategory, "the category");
  const geography = compact(input.geography, "priority markets");
  const buyer = inferBuyer(text, input.economicBuyer);
  const department = inferDepartment(text);
  const companyProfile = inferCompanyProfile(text);
  const marketScope = combineScopeAndProfile(geography, companyProfile);
  const problem = summarizeProblem(input.problemSolved, department);
  const trigger = inferTrigger(input, text);
  const alternatives = compact(input.currentAlternatives, "manual workflows, spreadsheets, agencies, or incumbent tools");
  const primaryAlternative = alternatives.split(/[,;\n]/)[0]?.trim() || "current workarounds";

  return [
    {
      id: "urgent-workflow-owner",
      segment: marketScope,
      description: `${department} that already feel ${problem} and are actively trying to improve the workflow.`,
      economicBuyer: buyer,
      buyingTrigger: trigger,
      whyItFits: `This ICP is closest to the problem narrative and should reveal whether the pain is urgent enough to support early Market Readiness.`,
      validationQuestion: `What happened recently that made ${problem} a must-solve priority rather than a nice-to-have?`,
      confidence: "High"
    },
    {
      id: "alternative-switcher",
      segment: `${geography} teams replacing ${primaryAlternative}`,
      description: `Buyers spending time or budget on current alternatives but dissatisfied with speed, accuracy, cost, or executive visibility.`,
      economicBuyer: buyer,
      buyingTrigger: `The current workaround breaks down, becomes too expensive, or fails in front of leadership.`,
      whyItFits: `Existing alternatives are strong pain proxies because they show buyers may already be paying to solve the problem.`,
      validationQuestion: `Which alternative would they choose if this product did not exist, and what would make them switch?`,
      confidence: alternatives === "manual workflows, spreadsheets, agencies, or incumbent tools" ? "Exploratory" : "Medium"
    },
    {
      id: "budget-owner",
      segment: `${category} buyers with budget ownership`,
      description: `${buyer}s who can approve a pilot or departmental subscription without waiting for a company-wide platform decision.`,
      economicBuyer: buyer,
      buyingTrigger: `A budget cycle, board-level metric, or department KPI makes the outcome measurable and fundable.`,
      whyItFits: `This ICP tests whether the market has a clear economic buyer, not just interested users.`,
      validationQuestion: `What existing budget, headcount, service spend, or tool line item would this replace?`,
      confidence: input.economicBuyer.trim() ? "High" : "Medium"
    },
    {
      id: "design-partner",
      segment: `${input.stage} design partners in ${geography}`,
      description: `Early adopters willing to co-design the workflow because the problem is frequent, visible, and tied to a measurable business outcome.`,
      economicBuyer: buyer,
      buyingTrigger: `They need a better answer before the next planning cycle, forecast review, audit, launch, or executive update.`,
      whyItFits: `This ICP is useful for pre-seed and seed validation because it focuses discovery on buyers likely to trade feedback for early access.`,
      validationQuestion: `Would they commit to a weekly usage ritual or paid pilot if the product solved the first painful job?`,
      confidence: "Exploratory"
    }
  ];
}
