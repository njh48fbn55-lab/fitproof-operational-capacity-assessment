import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AssessmentResult,
  GeneratedExecutiveReport,
  Lead,
  domains,
  generateExecutiveSummary,
  generateRisks,
  getOpenConstraint,
  Profile,
  questions,
  Responses,
  stageRecommendations
} from "@/lib/operational-capacity";

type SourcePage = {
  title: string;
  url: string;
  text: string;
  html: string;
};

type ReportSource = {
  title: string;
  url: string;
};

type CompletionPayload = {
  lead?: Lead & {
    name?: string;
    title?: string;
  };
  profile: Profile;
  responses: Responses;
  result: AssessmentResult;
};

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeUrl(input: string) {
  if (!input.trim()) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    return url.toString();
  } catch {
    return "";
  }
}

function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return textFromHtml(title || "") || fallback;
}

function extractCandidateLinks(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const candidates = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], baseUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => url.origin === base.origin)
    .filter((url) => !url.hash && !url.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx|xls|xlsx)$/i));

  const usefulPath = /(about|mission|program|service|impact|annual|financial|leadership|team|who-we-are|what-we-do|strategy|report|news|press|grant|contract|funding|career|jobs|plan)/i;
  const seen = new Set<string>();

  return candidates
    .filter((url) => usefulPath.test(url.pathname))
    .map((url) => {
      url.search = "";
      return url.toString();
    })
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 3);
}

async function fetchPage(url: string): Promise<SourcePage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FitProof Operational Capacity Assessment/1.0"
      },
      signal: controller.signal
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    return {
      title: titleFromHtml(html, new URL(url).hostname),
      url,
      text: textFromHtml(html).slice(0, 3000),
      html
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectWebsiteSources(rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  if (!url) return [];

  const home = await fetchPage(url);
  if (!home) return [];

  const links = extractCandidateLinks(home.html, url);
  const linkedPages = await Promise.all(links.map((link) => fetchPage(link)));

  return [home, ...linkedPages.filter((page): page is SourcePage => Boolean(page))]
    .filter((page) => page.text.length > 250)
    .slice(0, 4);
}

function fallbackReport(profile: Profile, responses: Responses, result: AssessmentResult, sources: SourcePage[] = [], reason?: string): GeneratedExecutiveReport {
  const recommendation = stageRecommendations[result.stage.number];
  const topRisks = generateRisks(result);
  const sourceSignals = sources.slice(0, 3).map((source) => `Reviewed ${source.title} for public mission, program, and operating-model context.`);
  const primaryStrainDrivers = result.topRiskDomains.map((domain) => ({
    category: domain.title,
    strain: `${domain.risk}/100 category strain score.`,
    evidence: `${domain.answered} scored responses were available in this category.`,
    whyItMatters: "This category is one of the highest-strain areas in the assessment and should be interpreted against the organization's service model, staffing model, and growth demands.",
    consequence: "If left unaddressed, this strain can increase manual work, slow decisions, and weaken service delivery reliability."
  }));

  return {
    generated: false,
    fallbackReason: reason || "AI report generation is not configured yet. Add OPENAI_API_KEY to enable organization-specific narrative generation.",
    executiveSummary: generateExecutiveSummary(profile, result),
    organizationSnapshot: sources.length
      ? `${profile.organization || "The organization"} was assessed using the submitted operational capacity responses. Public website content was collected and is ready for LLM enrichment once OPENAI_API_KEY is configured.`
      : `${profile.organization || "The organization"} was assessed using the submitted operational capacity responses. Add an organization website URL and configure the LLM key to enrich this section with public mission, program, and service-model signals.`,
    strainDiagnosis: `${result.stage.interpretation} The highest-scoring risk areas should be addressed first because they are the strongest indicators of operational strain in the assessment data.`,
    missionImplications: "Operational strain can limit service responsiveness, leadership visibility, and the ability to scale programs with confidence.",
    topRisks: topRisks.length
      ? topRisks
      : [
          "Operational strain should be interpreted from the highest section scores once the full assessment is completed.",
          "Incomplete assessment data limits the specificity of the top-risk diagnosis.",
          "The report will become more precise as more scored responses are provided."
        ],
    recommendations: recommendation.actions,
    fitProofEngagement: recommendation.cta,
    primaryStrainDrivers,
    recommendedEngagement: {
      recommendedOffering: recommendation.cta,
      whyThisOfferingFits: `${profile.organization || "The organization"} is in Stage ${result.stage.number}: ${result.stage.name}, with strain concentrated in ${result.topRiskDomains.map((domain) => domain.shortTitle).join(", ") || "the assessed sections"}.`,
      primaryObjectives: recommendation.actions.slice(0, 3),
      initialWorkplan: recommendation.actions,
      expectedOutcomes: ["Clearer operating priorities", "Reduced execution drag in the highest-strain areas", "Better visibility for leadership decisions"],
      suggestedTimeline: result.riskScore >= 75 ? "Immediate 30-60 day stabilization sprint" : "30-60 day diagnostic and implementation sprint",
      whyNow: "The assessment indicates operational strain that should be addressed before it compounds into service, staffing, reporting, or funding execution issues."
    },
    nextSteps: [
      "Validate the highest-strain categories with leadership and frontline owners.",
      "Identify the workflows, reports, and decisions most affected by current strain.",
      "Prioritize one 30-60 day stabilization sprint around the highest-consequence operating constraint."
    ],
    publicSignals: sourceSignals.length ? sourceSignals : ["No AI-enriched public website signals were available for this report."],
    sources: sources.map((source) => ({ title: source.title, url: source.url }))
  };
}

function responseSummary(responses: Responses) {
  const questionById = new Map(questions.map((question) => [question.id, question.prompt]));

  return Object.entries(responses)
    .map(([questionId, answer]) => `${questionById.get(questionId) || questionId}: ${Array.isArray(answer) ? answer.join(", ") : answer}`)
    .join("\n");
}

function slugify(value: string) {
  return (value || "organization")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "organization";
}

function safeTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function answerRecords(responses: Responses) {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));

  return questions.map((question) => ({
    questionId: question.id,
    question: question.prompt,
    sectionId: question.domainId,
    section: domainById.get(question.domainId)?.title || question.domainId,
    answer: responses[question.id] ?? null
  }));
}

function categoryStrainScores(result: AssessmentResult) {
  return result.domainScores.map((domain) => ({
    sectionId: domain.id,
    section: domain.title,
    shortTitle: domain.shortTitle,
    weight: domain.weight,
    strainScore: domain.risk,
    weightedStrain: domain.weightedRisk,
    answered: domain.answered
  }));
}

function reportToText(report: GeneratedExecutiveReport, result: AssessmentResult) {
  const engagement = report.recommendedEngagement;
  const primaryDrivers = report.primaryStrainDrivers?.length
    ? report.primaryStrainDrivers
        .map(
          (driver) =>
            `${driver.category}\nWhat the strain appears to be: ${driver.strain}\nEvidence: ${driver.evidence}\nWhy it matters: ${driver.whyItMatters}\nIf not addressed: ${driver.consequence}`
        )
        .join("\n\n")
    : report.topRisks.join("\n");

  return [
    "Executive Summary",
    report.executiveSummary,
    "",
    "Organization Snapshot",
    report.organizationSnapshot,
    "",
    "Spiral Stage Diagnosis",
    report.strainDiagnosis,
    "",
    `Overall Strain Score: ${result.riskScore}/100`,
    `Spiral Stage: Stage ${result.stage.number} - ${result.stage.name}`,
    "",
    "Primary Strain Drivers",
    primaryDrivers,
    "",
    "Implications for the Organization",
    report.missionImplications,
    "",
    "Recommended FitProof Engagement",
    `Recommended Offering: ${engagement?.recommendedOffering || report.fitProofEngagement}`,
    engagement ? `Why This Offering Fits: ${engagement.whyThisOfferingFits}` : "",
    engagement ? `Primary Objectives:\n${engagement.primaryObjectives.join("\n")}` : "",
    engagement ? `Initial Workplan:\n${engagement.initialWorkplan.join("\n")}` : "",
    engagement ? `Expected Outcomes:\n${engagement.expectedOutcomes.join("\n")}` : "",
    engagement ? `Suggested Timeline: ${engagement.suggestedTimeline}` : "",
    engagement ? `Why Now: ${engagement.whyNow}` : "",
    "",
    "Next 30-60 Days",
    (report.nextSteps || report.recommendations).join("\n"),
    "",
    "Public Signals Reviewed",
    report.publicSignals.join("\n"),
    "",
    "Sources",
    report.sources.map((source) => `${source.title}: ${source.url}`).join("\n")
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSubmission(payload: CompletionPayload, report: GeneratedExecutiveReport, sources: SourcePage[], timestamp: Date) {
  const respondent = {
    name: payload.lead?.name || null,
    email: payload.lead?.email || null,
    title: payload.lead?.title || null
  };

  return {
    submissionTimestamp: timestamp.toISOString(),
    organization: {
      name: payload.profile.organization,
      website: payload.profile.websiteUrl
    },
    respondent,
    answers: answerRecords(payload.responses),
    rawResponses: payload.responses,
    overallStrainScore: payload.result.riskScore,
    spiralStage: {
      number: payload.result.stage.number,
      name: payload.result.stage.name,
      interpretation: payload.result.stage.interpretation
    },
    categoryStrainScores: categoryStrainScores(payload.result),
    topStrainDrivers: payload.result.topRiskDomains.map((domain) => ({
      section: domain.title,
      strainScore: domain.risk
    })),
    generatedReport: report,
    generatedReportText: reportToText(report, payload.result),
    recommendedFitProofEngagement: report.recommendedEngagement?.recommendedOffering || report.fitProofEngagement,
    companyResearchEnrichmentData: {
      publicSignals: report.publicSignals,
      reportSources: report.sources,
      sources: sources.map((source) => ({
        title: source.title,
        url: source.url,
        textExcerpt: source.text
      }))
    }
  };
}

async function saveSubmission(submission: ReturnType<typeof buildSubmission>, organization: string, timestamp: Date) {
  const submissionsDir = process.env.ASSESSMENT_SUBMISSIONS_DIR || path.join(process.cwd(), "submissions");
  await mkdir(submissionsDir, { recursive: true });
  const filename = `assessment-${slugify(organization)}-${safeTimestamp(timestamp)}.json`;
  const filePath = path.join(submissionsDir, filename);
  await writeFile(filePath, JSON.stringify(submission, null, 2), "utf8");
  return filePath;
}

function buildEmailText(submission: ReturnType<typeof buildSubmission>) {
  return [
    `New FitProof Assessment Completed: ${submission.organization.name || "Organization"}`,
    "",
    `Organization: ${submission.organization.name || "Not provided"}`,
    `Website: ${submission.organization.website || "Not provided"}`,
    `Respondent name: ${submission.respondent.name || "Not collected"}`,
    `Respondent title: ${submission.respondent.title || "Not collected"}`,
    `Respondent email: ${submission.respondent.email || "Not collected"}`,
    "",
    `Overall strain score: ${submission.overallStrainScore}/100`,
    `Spiral stage: Stage ${submission.spiralStage.number} - ${submission.spiralStage.name}`,
    `Recommended FitProof engagement: ${submission.recommendedFitProofEngagement}`,
    "",
    "Top strain drivers:",
    submission.topStrainDrivers.map((driver) => `- ${driver.section}: ${driver.strainScore}/100`).join("\n"),
    "",
    "Full generated assessment/report:",
    submission.generatedReportText,
    "",
    "All raw answers:",
    submission.answers.map((answer) => `- ${answer.question}: ${Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer ?? "No answer"}`).join("\n"),
    "",
    "Company research/enrichment data used:",
    submission.companyResearchEnrichmentData.sources.map((source) => `- ${source.title}: ${source.url}`).join("\n") || "No public sources collected."
  ].join("\n");
}

function escapeHtmlEmail(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

async function sendSubmissionEmail(submission: ReturnType<typeof buildSubmission>) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ASSESSMENT_NOTIFICATION_EMAIL || "sean@fit-proof.com";

  if (!apiKey) {
    console.warn("Assessment notification email skipped: RESEND_API_KEY is not configured.");
    return;
  }

  const subject = `New FitProof Assessment Completed: ${submission.organization.name || "Organization"}`;
  const text = buildEmailText(submission);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.ASSESSMENT_NOTIFICATION_FROM || "FitProof Assessment <onboarding@resend.dev>",
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111111">${escapeHtmlEmail(text)}</div>`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend notification failed with status ${response.status}: ${errorText}`);
  }
}

async function retainAndNotifySubmission(payload: CompletionPayload, report: GeneratedExecutiveReport, sources: SourcePage[]) {
  const timestamp = new Date();
  const submission = buildSubmission(payload, report, sources, timestamp);

  try {
    const filePath = await saveSubmission(submission, payload.profile.organization, timestamp);
    console.log("Assessment submission saved", { filePath });
  } catch (error) {
    console.error("Assessment submission file save failed", error);
  }

  void sendSubmissionEmail(submission)
    .then(() => {
      console.log("Assessment notification email sent", {
        organization: payload.profile.organization,
        to: process.env.ASSESSMENT_NOTIFICATION_EMAIL || "sean@fit-proof.com"
      });
    })
    .catch((error) => {
      console.error("Assessment notification email failed", error);
    });
}

function buildPrompt(profile: Profile, responses: Responses, result: AssessmentResult, sources: SourcePage[]) {
  const sourceText = sources
    .map((source, index) => `SOURCE ${index + 1}: ${source.title}\nURL: ${source.url}\nTEXT: ${source.text}`)
    .join("\n\n");
  const categoryScores = result.domainScores
    .map((domain) => `${domain.title}: ${domain.risk}/100 strain score, ${domain.weight}% weight, ${domain.answered} scored responses`)
    .join("\n");

  return `You are generating an executive-level operational strain assessment for an organization that completed the FitProof assessment.

Rules:
- Do not use maturity scoring.
- Do not mention maturity score.
- The only scoring framework is operational strain.
- Use the deterministic strain score, category strain scores, spiral stage, weights, and flags as authoritative.
- Use public source text only as supporting context. Do not invent facts.
- If data is unavailable, say so plainly.
- Clearly distinguish known facts from reasonable inferences.
- Use the provided website crawl plus live web search, when available, to look for nonprofit analyzer style signals: annual reports, Form 990 or financial signals, grants and contracts, leadership changes, news, program footprint, strategic plans, service geography, funding model, and public growth or restructuring signals.
- Do not cite or rely on unsupported claims. If web search finds no reliable external signal, say that the signal was not available.
- Write in an executive advisory memo style: specific, commercially useful, direct but not alarmist, practical, and implementation-oriented.
- Avoid generic nonprofit filler and unsupported claims.
- Return only valid JSON with this exact shape:
{
  "executiveSummary": "string",
  "organizationSnapshot": "string",
  "strainDiagnosis": "string",
  "missionImplications": "string",
  "primaryStrainDrivers": [
    {
      "category": "string",
      "strain": "string",
      "evidence": "string",
      "whyItMatters": "string",
      "consequence": "string"
    }
  ],
  "topRisks": ["string", "string", "string"],
  "recommendations": ["string", "string", "string", "string", "string"],
  "fitProofEngagement": "string",
  "recommendedEngagement": {
    "recommendedOffering": "string",
    "whyThisOfferingFits": "string",
    "primaryObjectives": ["string", "string", "string"],
    "initialWorkplan": ["string", "string", "string", "string"],
    "expectedOutcomes": ["string", "string", "string"],
    "suggestedTimeline": "string",
    "whyNow": "string"
  },
  "nextSteps": ["string", "string", "string", "string", "string"],
  "publicSignals": ["string", "string", "string"]
}

Report structure and content requirements:
1. Executive Summary: Write 2-4 strong paragraphs. Include the organization spiral stage, strain score, major strain drivers, and likely organizational consequences. Tie the analysis directly to the organization programs, revenue model, operating complexity, service delivery, staffing model, geography, growth plans, and mission when supported by available data.
2. Organization Snapshot: Provide a researched snapshot of what the organization does, who it serves, where it operates, major services or programs, apparent revenue streams, business model, scale, recent news or strategic signals, and what those facts suggest about current direction or pressure points. Clearly distinguish known facts from reasonable inferences.
3. Spiral Stage Diagnosis: Explain what the assigned spiral stage means and how the organization appears to be experiencing that stage based on assessment responses and company context.
4. Primary Strain Drivers: Identify the top strain categories. For each, explain what the strain appears to be, what evidence supports it, why it matters for this organization, and what could happen if it is not addressed.
5. Implications for the Organization: Explain likely operational, financial, staffing, compliance, service delivery, and mission implications specific to the organization.
6. Recommended FitProof Engagement: Recommend one specific FitProof engagement using the required format in recommendedEngagement.
7. Next 30-60 Days: Provide a practical action plan with first steps.

Offering logic:
- Early strain / signal stage: Operational Readiness Assessment or Revenue Operations Diagnostic
- Knowledge Fragmentation: Knowledge Infrastructure & Process Stabilization Sprint
- Process Breakdown: Operational Stabilization & Revenue Process Optimization Engagement
- Leadership Bottleneck: Executive Operating System & Decision Infrastructure Engagement
- Reactive Operations: Full Operational Turnaround Readiness Engagement
- Mission Drag or severe strain: Mission-Critical Operating Model Reset

Organization:
${profile.organization || "Unknown organization"}
Website:
${profile.websiteUrl || "No website provided"}

Overall operational strain score:
${result.riskScore}/100

Spiral stage:
Stage ${result.stage.number}: ${result.stage.name}
${result.stage.interpretation}

Category strain scores:
${categoryScores}

Assessment responses:
${responseSummary(responses) || "No responses available."}

Open text constraint:
${getOpenConstraint(responses) || "None provided"}

Public website content:
${sourceText || "No public website content available."}`;
}

async function generateWithOpenAI(profile: Profile, responses: Responses, result: AssessmentResult, sources: SourcePage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const webSearchEnabled = process.env.OPENAI_WEB_SEARCH_ENABLED !== "false";

  const reportSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "executiveSummary",
      "organizationSnapshot",
      "strainDiagnosis",
      "missionImplications",
      "primaryStrainDrivers",
      "topRisks",
      "recommendations",
      "fitProofEngagement",
      "recommendedEngagement",
      "nextSteps",
      "publicSignals"
    ],
    properties: {
      executiveSummary: { type: "string" },
      organizationSnapshot: { type: "string" },
      strainDiagnosis: { type: "string" },
      missionImplications: { type: "string" },
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

  const requestBody = {
    model: process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini",
    input: buildPrompt(profile, responses, result, sources),
    tools: webSearchEnabled ? [{ type: "web_search" }] : undefined,
    tool_choice: webSearchEnabled ? "auto" : undefined,
    text: {
      format: {
        type: "json_schema",
        name: "fitproof_operational_strain_report",
        strict: true,
        schema: reportSchema
      }
    },
    temperature: 0.2,
    max_output_tokens: 3500
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI report request failed with status ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();
  const text =
    payload.output_text ||
    payload.output?.flatMap((item: { content?: { text?: string }[] }) => item.content || []).map((content: { text?: string }) => content.text || "").join("") ||
    "";

  if (!text.trim()) {
    throw new Error(`OpenAI report response did not include output_text: ${JSON.stringify(payload).slice(0, 1000)}`);
  }

  const parsed = JSON.parse(extractJson(text)) as Omit<GeneratedExecutiveReport, "generated" | "sources">;
  const reportSources = mergeReportSources(
    sources.map((source) => ({ title: source.title, url: source.url })),
    extractOpenAIWebSources(payload)
  );

  return {
    generated: true,
    ...parsed,
    sources: reportSources
  } satisfies GeneratedExecutiveReport;
}

function mergeReportSources(primary: ReportSource[], secondary: ReportSource[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function extractOpenAIWebSources(payload: {
  output?: {
    type?: string;
    action?: {
      sources?: {
        title?: string;
        url?: string;
      }[];
    };
    content?: {
      annotations?: {
        type?: string;
        title?: string;
        url?: string;
      }[];
    }[];
  }[];
}) {
  const sources: ReportSource[] = [];

  payload.output?.forEach((item) => {
    item.action?.sources?.forEach((source) => {
      if (source.url) sources.push({ title: source.title || source.url, url: source.url });
    });

    item.content?.forEach((content) => {
      content.annotations?.forEach((annotation) => {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.push({ title: annotation.title || annotation.url, url: annotation.url });
        }
      });
    });
  });

  return sources;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CompletionPayload;

  const sources = await collectWebsiteSources(payload.profile.websiteUrl);

  try {
    const generated = await generateWithOpenAI(payload.profile, payload.responses, payload.result, sources);

    if (generated) {
      await retainAndNotifySubmission(payload, generated, sources);
      return NextResponse.json(generated);
    }

    const fallback = fallbackReport(
      payload.profile,
      payload.responses,
      payload.result,
      sources,
      sources.length ? "AI report generation is not configured yet. Add OPENAI_API_KEY to use the collected public website content in the executive narrative." : undefined
    );
    await retainAndNotifySubmission(payload, fallback, sources);

    return NextResponse.json(fallback);
  } catch (error) {
    console.error("AI report generation failed", error);
    const fallback = fallbackReport(payload.profile, payload.responses, payload.result, sources, "AI report generation failed, so the deterministic executive report is shown instead.");
    await retainAndNotifySubmission(payload, fallback, sources);
    return NextResponse.json(fallback);
  }
}
