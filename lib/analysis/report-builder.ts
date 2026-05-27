import { AssessmentResult, GeneratedExecutiveReport, Profile, Responses, generateExecutiveSummary, generateRisks, stageRecommendations } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult, FinancialMetricName, FinancialYear } from "@/lib/nonprofit-viability/types";
import { WorkforceCapacityAnalysis } from "@/lib/workforce-capacity/types";

export async function buildGeneratedReport({
  profile,
  responses,
  result,
  enhancedAnalysis,
  workforceCapacityAnalysis
}: {
  profile: Profile;
  responses: Responses;
  result: AssessmentResult;
  enhancedAnalysis: EnhancedAnalysisResult | null;
  workforceCapacityAnalysis: WorkforceCapacityAnalysis | null;
}) {
  const fallback = deterministicReport(profile, result, enhancedAnalysis, workforceCapacityAnalysis);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ...fallback, fallbackReason: "AI report generation skipped because OPENAI_API_KEY is not configured." };

  try {
    return await generateWithOpenAI(apiKey, profile, responses, result, enhancedAnalysis, workforceCapacityAnalysis);
  } catch (error) {
    console.error("Background OpenAI report generation failed", error);
    return { ...fallback, fallbackReason: userFacingReportError(error) };
  }
}

function deterministicReport(profile: Profile, result: AssessmentResult, enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null): GeneratedExecutiveReport {
  const recommendation = stageRecommendations[result.stage.number];
  const financialAnalysis = enhancedAnalysis ? financialNarrative(enhancedAnalysis) : "No public financial trend analysis was available.";
  const strategicSignals = enhancedAnalysis ? strategyNarrative(enhancedAnalysis) : "No website strategy or public signal analysis was available.";
  const staffingCapacityAnalysis = workforceCapacityAnalysis ? staffingNarrative(workforceCapacityAnalysis) : "No public workforce capacity analysis was available.";

  return {
    generated: false,
    executiveSummary: generateExecutiveSummary(profile, result),
    organizationSnapshot: `${profile.organization || "The organization"} was assessed using submitted operational strain responses${enhancedAnalysis?.organization.ein ? ` and public nonprofit records for EIN ${enhancedAnalysis.organization.ein}` : ""}.`,
    strainDiagnosis: `${result.stage.interpretation} The highest-scoring risk areas should be interpreted together with the financial and public strategy context.`,
    missionImplications: "Operational strain can limit service responsiveness, leadership visibility, and the ability to pursue future plans with confidence.",
    financialAnalysis,
    staffingCapacityAnalysis,
    strategicSignals,
    primaryStrainDrivers: result.topRiskDomains.map((domain) => ({
      category: domain.title,
      strain: `${domain.risk}/100 category strain score.`,
      evidence: `${domain.answered} scored responses were available in this section.`,
      whyItMatters: "This area is one of the strongest operating constraints in the assessment and should be interpreted alongside financial trend and growth signals.",
      consequence: "If left unaddressed, this strain can increase manual work, weaken reporting, slow decisions, and pressure mission delivery."
    })),
    topRisks: generateRisks(result),
    recommendations: recommendation.actions,
    fitProofEngagement: recommendation.cta,
    recommendedEngagement: {
      recommendedOffering: recommendation.cta,
      whyThisOfferingFits: `${profile.organization || "The organization"} is in Stage ${result.stage.number}: ${result.stage.name}, with strain concentrated in ${result.topRiskDomains.map((domain) => domain.shortTitle).join(", ") || "the assessed sections"}.`,
      primaryObjectives: recommendation.actions.slice(0, 3),
      initialWorkplan: recommendation.actions,
      expectedOutcomes: ["Clearer operating priorities", "Reduced execution drag in the highest-strain areas", "Better visibility for leadership decisions"],
      suggestedTimeline: result.riskScore >= 75 ? "Immediate 30-60 day stabilization sprint" : "30-60 day diagnostic and implementation sprint",
      whyNow: "The assessment indicates operational strain that should be addressed before it compounds into service, staffing, reporting, or funding execution issues."
    },
    nextSteps: recommendation.actions,
    publicSignals: [
      ...(enhancedAnalysis ? publicSignals(enhancedAnalysis) : ["No enriched public signals were available."]),
      ...(workforceCapacityAnalysis ? workforcePublicSignals(workforceCapacityAnalysis) : [])
    ],
    sources: [
      ...(enhancedAnalysis ? enhancedAnalysis.sources.filter((source) => source.url).map((source) => ({ title: source.title, url: source.url || "" })) : []),
      ...(workforceCapacityAnalysis ? workforceCapacityAnalysis.careers.sources.filter((source) => source.url).map((source) => ({ title: source.title, url: source.url || "" })) : [])
    ]
  };
}

async function generateWithOpenAI(apiKey: string, profile: Profile, responses: Responses, result: AssessmentResult, enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null): Promise<GeneratedExecutiveReport> {
  const schema = reportSchema();
  const body = {
    model: process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini",
    input: reportPrompt(profile, responses, result, enhancedAnalysis, workforceCapacityAnalysis),
    text: {
      format: {
        type: "json_schema",
        name: "fitproof_background_operational_report",
        strict: true,
        schema
      }
    },
    temperature: 0.2,
    max_output_tokens: 6000
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI report request failed with status ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const text =
    payload.output_text ||
    payload.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).map((content: { text?: string }) => content.text || "").join("") ||
    "";
  const parsed = JSON.parse(extractJson(text)) as Omit<GeneratedExecutiveReport, "generated" | "sources">;

  return {
    generated: true,
    ...parsed,
    sources: [
      ...(enhancedAnalysis ? enhancedAnalysis.sources.filter((source) => source.url).map((source) => ({ title: source.title, url: source.url || "" })) : []),
      ...(workforceCapacityAnalysis ? workforceCapacityAnalysis.careers.sources.filter((source) => source.url).map((source) => ({ title: source.title, url: source.url || "" })) : [])
    ]
  };
}

function reportPrompt(profile: Profile, responses: Responses, result: AssessmentResult, enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null) {
  return `Generate a FitProof executive operational strain report.

Rules:
- Do not use maturity scoring.
- Do not invent financial values.
- Use calculations and extracted metrics as source of truth.
- Use summaries and public signals for interpretation only.
- Explain how operational responses, financial trend, liquidity, staffing capacity, and future strategy roadblocks interact.
- Use workforce capacity data only as public hiring signal evidence.
- Do not claim actual turnover, burnout, or employee sentiment unless directly evidenced by a public source.
- Use careful wording such as "signals of operational strain", "possible hiring pressure", "capacity constraints may exist", and "extended vacancy duration may indicate recruiting challenges."

Organization: ${profile.organization}
Website: ${profile.websiteUrl}
Strain score: ${result.riskScore}/100
Spiral stage: Stage ${result.stage.number}: ${result.stage.name}
Category scores: ${result.domainScores.map((domain) => `${domain.title}: ${domain.risk}/100`).join("; ")}
Responses: ${JSON.stringify(responses)}

Enhanced financial and public context:
${enhancedAnalysis ? enhancedAnalysisPromptContext(enhancedAnalysis) : "No enhanced context available."}

Workforce capacity and public hiring context:
${workforceCapacityAnalysis ? workforcePromptContext(workforceCapacityAnalysis) : "No workforce capacity context available."}`;
}

function reportSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["executiveSummary", "organizationSnapshot", "strainDiagnosis", "missionImplications", "financialAnalysis", "staffingCapacityAnalysis", "strategicSignals", "primaryStrainDrivers", "topRisks", "recommendations", "fitProofEngagement", "recommendedEngagement", "nextSteps", "publicSignals"],
    properties: {
      executiveSummary: { type: "string" },
      organizationSnapshot: { type: "string" },
      strainDiagnosis: { type: "string" },
      missionImplications: { type: "string" },
      financialAnalysis: { type: "string" },
      staffingCapacityAnalysis: { type: "string" },
      strategicSignals: { type: "string" },
      primaryStrainDrivers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["category", "strain", "evidence", "whyItMatters", "consequence"],
          properties: {
            category: { type: "string" },
            strain: { type: "string" },
            evidence: { type: "string" },
            whyItMatters: { type: "string" },
            consequence: { type: "string" }
          }
        }
      },
      topRisks: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      fitProofEngagement: { type: "string" },
      recommendedEngagement: {
        type: "object",
        additionalProperties: false,
        required: ["recommendedOffering", "whyThisOfferingFits", "primaryObjectives", "initialWorkplan", "expectedOutcomes", "suggestedTimeline", "whyNow"],
        properties: {
          recommendedOffering: { type: "string" },
          whyThisOfferingFits: { type: "string" },
          primaryObjectives: { type: "array", items: { type: "string" } },
          initialWorkplan: { type: "array", items: { type: "string" } },
          expectedOutcomes: { type: "array", items: { type: "string" } },
          suggestedTimeline: { type: "string" },
          whyNow: { type: "string" }
        }
      },
      nextSteps: { type: "array", items: { type: "string" } },
      publicSignals: { type: "array", items: { type: "string" } }
    }
  };
}

function enhancedAnalysisPromptContext(enhancedAnalysis: EnhancedAnalysisResult) {
  return [
    `Matched organization: ${enhancedAnalysis.organization.legalName || "Unknown"} (${enhancedAnalysis.organization.ein || "EIN unavailable"}), confidence ${enhancedAnalysis.organization.sourceConfidence}.`,
    `Viability score: ${enhancedAnalysis.viabilityScore.total}/100 (${enhancedAnalysis.viabilityScore.classification}).`,
    `Risk flags: ${enhancedAnalysis.viabilityScore.riskFlags.join("; ") || "No major calculated flags."}`,
    `Financial trend:\n${enhancedAnalysis.financialYears.map((year) => financialYearLine(year)).join("\n") || "No financial years available."}`,
    `Website strategy signals: ${enhancedAnalysis.websiteAnalysis.strategicPriorities.join(" | ") || "Unavailable."}`,
    `Expansion signals: ${enhancedAnalysis.websiteAnalysis.programExpansionSignals.join(" | ") || "Unavailable."}`,
    `Operational complexity signals: ${enhancedAnalysis.websiteAnalysis.operationalComplexitySignals.join(" | ") || "Unavailable."}`,
    `Annual/impact/audit links: ${[...enhancedAnalysis.websiteAnalysis.annualReportLinks, ...enhancedAnalysis.websiteAnalysis.auditFinancialLinks].join(" | ") || "Unavailable."}`,
    `Sources: ${enhancedAnalysis.sources.slice(0, 12).map((source) => `${source.title} (${source.sourceType}, ${source.confidence})`).join(" | ") || "Unavailable."}`
  ].join("\n");
}

function financialYearLine(year: FinancialYear) {
  return `FY ${year.fiscalYear}: revenue=${metric(year, "totalRevenue")}; expenses=${metric(year, "totalExpenses")}; surplus/deficit=${metric(year, "surplusDeficit")}; margin=${metric(year, "surplusMargin")}; cash/investments=${metric(year, "cashAndInvestments")}; current ratio=${metric(year, "currentRatio")}; source=${year.sourceNote}`;
}

function metric(year: FinancialYear, name: FinancialMetricName) {
  const value = year.metrics.find((item) => item.name === name)?.value;
  return value === null || value === undefined ? "unavailable" : String(Math.round(value * 100) / 100);
}

function financialNarrative(enhancedAnalysis: EnhancedAnalysisResult) {
  const latest = enhancedAnalysis.financialYears[0];
  if (!latest) return "No public financial trend data was available.";
  return `Latest available public financial year is FY ${latest.fiscalYear}. Viability score is ${enhancedAnalysis.viabilityScore.total}/100 (${enhancedAnalysis.viabilityScore.classification}). Key flags: ${enhancedAnalysis.viabilityScore.riskFlags.join("; ") || "no major calculated flags"}.`;
}

function staffingNarrative(workforceCapacityAnalysis: WorkforceCapacityAnalysis) {
  const metrics = workforceCapacityAnalysis.metrics;
  const ratio = metrics.openRoleRatio === null ? "open-role ratio unavailable" : `open-role ratio approximately ${Math.round(metrics.openRoleRatio * 100)}%`;
  const age = metrics.averageRequisitionAgeDays === null ? "posting age unavailable" : `average visible requisition age approximately ${metrics.averageRequisitionAgeDays} days`;
  return `${workforceCapacityAnalysis.narrative.staffingCapacitySummary} Public hiring review found ${metrics.totalOpenPositions} open role(s), ${metrics.leadershipOpenings} senior/leadership opening(s), ${ratio}, and ${age}. These are signals of possible staffing capacity pressure, not proof of turnover, burnout, or employee sentiment.`;
}

function strategyNarrative(enhancedAnalysis: EnhancedAnalysisResult) {
  const signals = [
    ...enhancedAnalysis.websiteAnalysis.strategicPriorities,
    ...enhancedAnalysis.websiteAnalysis.programExpansionSignals,
    ...enhancedAnalysis.websiteAnalysis.operationalComplexitySignals
  ];
  return signals.length ? signals.slice(0, 5).join(" ") : "No clear public strategy or expansion signals were available from the reviewed sources.";
}

function workforcePromptContext(workforceCapacityAnalysis: WorkforceCapacityAnalysis) {
  const metrics = workforceCapacityAnalysis.metrics;
  const departments = Object.entries(metrics.openPositionsByDepartment)
    .map(([department, count]) => `${department}: ${count}`)
    .join("; ");

  return [
    `Public open roles: ${metrics.totalOpenPositions}.`,
    `Open roles by department: ${departments || "Unavailable."}`,
    `Leadership openings: ${metrics.leadershipOpenings}.`,
    `Estimated workforce size: ${workforceCapacityAnalysis.workforceSize.estimatedEmployeeCount ?? "Unavailable"} (${workforceCapacityAnalysis.workforceSize.confidence} confidence).`,
    `Open-role ratio: ${metrics.openRoleRatio ?? "Unavailable"}.`,
    `Average requisition age: ${metrics.averageRequisitionAgeDays ?? "Unavailable"} days.`,
    `Aged postings: >30 days=${percent(metrics.percentOpenMoreThan30Days)}, >60 days=${percent(metrics.percentOpenMoreThan60Days)}, >90 days=${percent(metrics.percentOpenMoreThan90Days)}.`,
    `Staffing risk indicator: ${workforceCapacityAnalysis.riskScore.level} (${workforceCapacityAnalysis.riskScore.score}/100).`,
    `Indicators: ${workforceCapacityAnalysis.riskScore.indicators.join("; ") || "Unavailable."}`,
    `Evidence: ${workforceCapacityAnalysis.riskScore.evidence.join("; ") || "Unavailable."}`,
    `Recommendations: ${workforceCapacityAnalysis.narrative.recommendations.join("; ")}`,
    `Hiring sources reviewed: ${workforceCapacityAnalysis.careers.searchedUrls.slice(0, 10).join(" | ") || "Unavailable."}`
  ].join("\n");
}

function workforcePublicSignals(workforceCapacityAnalysis: WorkforceCapacityAnalysis) {
  return [
    `Workforce capacity signal: ${workforceCapacityAnalysis.riskScore.level}.`,
    ...workforceCapacityAnalysis.riskScore.evidence,
    ...workforceCapacityAnalysis.careers.sources.slice(0, 5).map((source) => `Reviewed ${source.title} for public hiring signals.`)
  ];
}

function publicSignals(enhancedAnalysis: EnhancedAnalysisResult) {
  return [
    ...enhancedAnalysis.viabilityScore.riskFlags,
    ...enhancedAnalysis.publicRecords.map((record) => `${record.title}: ${record.relevance}`),
    ...enhancedAnalysis.sources.slice(0, 5).map((source) => `Reviewed ${source.title} (${source.sourceType}).`)
  ];
}

function percent(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value * 100)}%`;
}

function userFacingReportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/status 401/i.test(message)) return "AI report generation failed because the OpenAI API key was rejected.";
  if (/status 429/i.test(message)) return "AI report generation failed because the OpenAI account is rate-limited or out of quota.";
  return `AI report generation failed: ${message.slice(0, 300)}`;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}
