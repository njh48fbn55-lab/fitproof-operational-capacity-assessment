import { NextResponse } from "next/server";
import {
  AssessmentResult,
  GeneratedExecutiveReport,
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
    .slice(0, 5);
}

async function fetchPage(url: string): Promise<SourcePage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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
      text: textFromHtml(html).slice(0, 6000),
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
    .slice(0, 6);
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REPORT_MODEL || "gpt-4.1-mini",
      input: buildPrompt(profile, responses, result, sources),
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI report request failed with status ${response.status}`);
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
    sources: sources.map((source) => ({ title: source.title, url: source.url }))
  } satisfies GeneratedExecutiveReport;
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
  const payload = (await request.json()) as {
    profile: Profile;
    responses: Responses;
    result: AssessmentResult;
  };

  const sources = await collectWebsiteSources(payload.profile.websiteUrl);

  try {
    const generated = await generateWithOpenAI(payload.profile, payload.responses, payload.result, sources);

    if (generated) {
      return NextResponse.json(generated);
    }

    return NextResponse.json(
      fallbackReport(
        payload.profile,
        payload.responses,
        payload.result,
        sources,
        sources.length ? "AI report generation is not configured yet. Add OPENAI_API_KEY to use the collected public website content in the executive narrative." : undefined
      )
    );
  } catch (error) {
    console.error("AI report generation failed", error);
    return NextResponse.json(
      fallbackReport(payload.profile, payload.responses, payload.result, sources, "AI report generation failed, so the deterministic executive report is shown instead.")
    );
  }
}
