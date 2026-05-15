import { AssessmentInput } from "@/lib/scoring";

export type IcpSuggestion = {
  id: string;
  segment: string;
  verticals: string[];
  excludedVerticals: string[];
  description: string;
  economicBuyer: string;
  endUser: string;
  buyingTrigger: string;
  reasoning: string;
  painIntensityReasoning: string;
  budgetReasoning: string;
  urgencyReasoning: string;
  reachabilityReasoning: string;
  currentAlternatives: string[];
  whyItFits: string;
  whyNotOthers: string;
  validationQuestions: string[];
  validationQuestion: string;
  recommendedDiscoveryMotion: string;
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

function inferVerticals(text: string) {
  const verticals = new Set<string>();

  if (hasAny(text, ["sales", "revenue", "revops", "forecast", "pipeline", "crm"])) {
    verticals.add("B2B SaaS");
    verticals.add("Revenue Operations");
    verticals.add("Sales-led organizations");
  }
  if (hasAny(text, ["finance", "cash", "budget", "forecasting", "invoice", "cfo"])) {
    verticals.add("Fintech");
    verticals.add("Finance teams");
    verticals.add("Professional services");
  }
  if (hasAny(text, ["security", "compliance", "risk", "audit", "privacy"])) {
    verticals.add("Regulated industries");
    verticals.add("Cybersecurity");
    verticals.add("Healthcare");
    verticals.add("Financial services");
  }
  if (hasAny(text, ["support", "ticket", "customer success", "churn", "retention"])) {
    verticals.add("Subscription software");
    verticals.add("Customer support");
    verticals.add("E-commerce");
  }
  if (hasAny(text, ["hiring", "talent", "recruit", "employee", "hr"])) {
    verticals.add("Talent technology");
    verticals.add("Staffing");
    verticals.add("High-growth companies");
  }
  if (hasAny(text, ["marketing", "campaign", "content", "demand gen", "brand"])) {
    verticals.add("Marketing teams");
    verticals.add("Agencies");
    verticals.add("B2B demand generation");
  }
  if (hasAny(text, ["founder", "startup", "seed", "pre-seed"])) {
    verticals.add("Startups");
    verticals.add("Venture-backed companies");
  }

  if (!verticals.size) {
    verticals.add("B2B services");
    verticals.add("Operationally complex teams");
    verticals.add("Software-enabled businesses");
  }

  return Array.from(verticals).slice(0, 5);
}

function inferExcludedVerticals(text: string) {
  const excluded = new Set<string>();

  if (!hasAny(text, ["enterprise", "procurement", "compliance", "audit"])) {
    excluded.add("Large enterprises with long procurement cycles");
  }
  if (!hasAny(text, ["smb", "small business", "owner"])) {
    excluded.add("Very small businesses without dedicated budget owners");
  }
  if (!hasAny(text, ["consumer", "b2c", "creator"])) {
    excluded.add("Consumer or creator markets");
  }
  if (!hasAny(text, ["regulated", "healthcare", "finance", "compliance", "audit"])) {
    excluded.add("Highly regulated buyers unless compliance is part of the core pain");
  }

  return Array.from(excluded).slice(0, 4);
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
  const verticals = inferVerticals(text);
  const excludedVerticals = inferExcludedVerticals(text);
  const problem = summarizeProblem(input.problemSolved, department);
  const trigger = inferTrigger(input, text);
  const alternatives = compact(input.currentAlternatives, "manual workflows, spreadsheets, agencies, or incumbent tools");
  const primaryAlternative = alternatives.split(/[,;\n]/)[0]?.trim() || "current workarounds";
  const alternativesList = alternatives.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
  const endUser = department.replace(/\bteams\b/i, "operators");

  return [
    {
      id: "urgent-workflow-owner",
      segment: marketScope,
      verticals: verticals.slice(0, 4),
      excludedVerticals,
      description: `${department} that already feel ${problem} and are actively trying to improve the workflow.`,
      economicBuyer: buyer,
      endUser,
      buyingTrigger: trigger,
      reasoning: `Prioritize verticals where ${department} already own measurable outcomes and the problem creates visible operating drag. These markets should produce clearer urgency signals in discovery.`,
      painIntensityReasoning: `The pain appears stronger when it creates repeated manual work, executive visibility, or measurable operating risk.`,
      budgetReasoning: `Budget is most plausible where ${buyer} can connect the workflow to a KPI, existing tool spend, services spend, or headcount savings.`,
      urgencyReasoning: `Urgency should be validated by asking what changed recently and what happens if the buyer waits another quarter.`,
      reachabilityReasoning: `This segment is reachable if the team has a named owner, uses recognizable tools, and can be found through communities, LinkedIn, partner channels, or competitor intent.`,
      currentAlternatives: alternativesList,
      whyItFits: `This ICP is closest to the problem narrative and should reveal whether the pain is urgent enough to support early Market Readiness.`,
      whyNotOthers: `Avoid broad horizontal segments until discovery proves the pain repeats across industries with the same buyer, budget, and trigger.`,
      validationQuestions: [
        `What happened recently that made ${problem} a must-solve priority rather than a nice-to-have?`,
        `How often does this workflow create visible cost, delay, risk, or executive escalation?`,
        `Who owns the KPI that would improve if this product worked?`
      ],
      validationQuestion: `What happened recently that made ${problem} a must-solve priority rather than a nice-to-have?`,
      recommendedDiscoveryMotion: `Interview 10 ${endUser} and 5 ${buyer}s; compare urgency, budget source, current workaround, and switching trigger.`,
      confidence: "High"
    },
    {
      id: "alternative-switcher",
      segment: `${geography} teams replacing ${primaryAlternative}`,
      verticals: verticals.filter((vertical) => vertical !== "Startups").slice(0, 4),
      excludedVerticals,
      description: `Buyers spending time or budget on current alternatives but dissatisfied with speed, accuracy, cost, or executive visibility.`,
      economicBuyer: buyer,
      endUser,
      buyingTrigger: `The current workaround breaks down, becomes too expensive, or fails in front of leadership.`,
      reasoning: `This segment is attractive because the alternative already exists in the workflow. That makes it easier to test switching intent, budget availability, and willingness to pay.`,
      painIntensityReasoning: `Existing alternatives are evidence that the buyer has already felt enough pain to change behavior or allocate resources.`,
      budgetReasoning: `Budget can be tested by mapping spend on ${primaryAlternative}, services, extra headcount, or adjacent tools.`,
      urgencyReasoning: `Urgency is strongest if the alternative creates missed deadlines, bad decisions, customer impact, or leadership embarrassment.`,
      reachabilityReasoning: `These buyers are findable through alternative-user communities, competitor pages, review sites, and job titles tied to the workflow.`,
      currentAlternatives: alternativesList,
      whyItFits: `Existing alternatives are strong pain proxies because they show buyers may already be paying to solve the problem.`,
      whyNotOthers: `Avoid buyers with no current workaround because education cost may be too high for an early go-to-market motion.`,
      validationQuestions: [
        `Which alternative would they choose if this product did not exist, and what would make them switch?`,
        `What is frustrating, expensive, or risky about ${primaryAlternative}?`,
        `What would need to be true for them to replace the current workaround this quarter?`
      ],
      validationQuestion: `Which alternative would they choose if this product did not exist, and what would make them switch?`,
      recommendedDiscoveryMotion: `Run competitor-switch interviews and ask buyers to rank current alternatives by cost, risk, speed, and trust.`,
      confidence: alternatives === "manual workflows, spreadsheets, agencies, or incumbent tools" ? "Exploratory" : "Medium"
    },
    {
      id: "budget-owner",
      segment: `${category} buyers with budget ownership`,
      verticals: verticals.slice(0, 5),
      excludedVerticals,
      description: `${buyer}s who can approve a pilot or departmental subscription without waiting for a company-wide platform decision.`,
      economicBuyer: buyer,
      endUser,
      buyingTrigger: `A budget cycle, board-level metric, or department KPI makes the outcome measurable and fundable.`,
      reasoning: `This ICP focuses on buyer power. It is strongest in verticals where the same person feels the pain, owns the KPI, and can fund a test without broad consensus.`,
      painIntensityReasoning: `The pain is more valuable when it maps directly to a KPI the buyer is already measured against.`,
      budgetReasoning: `Budget is strongest if the buyer can reallocate tool spend, services spend, or operational budget without platform-level procurement.`,
      urgencyReasoning: `Urgency should be tied to a planning cycle, board metric, budget review, compliance deadline, or operational failure.`,
      reachabilityReasoning: `Reachability is strongest where the buyer role is specific, searchable, and concentrated in identifiable verticals.`,
      currentAlternatives: alternativesList,
      whyItFits: `This ICP tests whether the market has a clear economic buyer, not just interested users.`,
      whyNotOthers: `Avoid end-user-only segments if the user feels pain but lacks budget authority or executive sponsorship.`,
      validationQuestions: [
        `What existing budget, headcount, service spend, or tool line item would this replace?`,
        `Who signs off on a paid pilot, and what proof do they require?`,
        `Which metric would justify renewal after 90 days?`
      ],
      validationQuestion: `What existing budget, headcount, service spend, or tool line item would this replace?`,
      recommendedDiscoveryMotion: `Run budget-owner interviews focused on procurement path, renewal metric, pilot threshold, and replaceable spend.`,
      confidence: input.economicBuyer.trim() ? "High" : "Medium"
    },
    {
      id: "design-partner",
      segment: `${input.stage} design partners in ${geography}`,
      verticals: ["Venture-backed companies", ...verticals].filter((vertical, index, list) => list.indexOf(vertical) === index).slice(0, 5),
      excludedVerticals,
      description: `Early adopters willing to co-design the workflow because the problem is frequent, visible, and tied to a measurable business outcome.`,
      economicBuyer: buyer,
      endUser,
      buyingTrigger: `They need a better answer before the next planning cycle, forecast review, audit, launch, or executive update.`,
      reasoning: `This profile is useful when the product is early because design partners can validate workflow frequency, language, and activation moments before scale channels are clear.`,
      painIntensityReasoning: `Design partners are useful only if the pain occurs often enough to support weekly usage or repeated feedback.`,
      budgetReasoning: `Budget is less certain here, so paid pilots or LOIs should be used to separate curiosity from market pull.`,
      urgencyReasoning: `Urgency should be validated through time-bound events such as reviews, launches, audits, board meetings, or customer commitments.`,
      reachabilityReasoning: `Early adopters are usually reachable through founder networks, operator communities, advisors, investors, and targeted outbound.`,
      currentAlternatives: alternativesList,
      whyItFits: `This ICP is useful for pre-seed and seed validation because it focuses discovery on buyers likely to trade feedback for early access.`,
      whyNotOthers: `Avoid passive design partners who provide feedback but will not change workflow, commit usage, or pay for a pilot.`,
      validationQuestions: [
        `Would they commit to a weekly usage ritual or paid pilot if the product solved the first painful job?`,
        `What workflow would they let the product touch in the first two weeks?`,
        `What success metric would make them become a reference customer?`
      ],
      validationQuestion: `Would they commit to a weekly usage ritual or paid pilot if the product solved the first painful job?`,
      recommendedDiscoveryMotion: `Recruit 5 design partners and require a defined workflow, weekly usage commitment, and measurable success criteria.`,
      confidence: "Exploratory"
    }
  ];
}
