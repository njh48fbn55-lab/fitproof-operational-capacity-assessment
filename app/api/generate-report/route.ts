import { NextResponse } from "next/server";
import {
  AssessmentResult,
  GeneratedExecutiveReport,
  generateExecutiveSummary,
  generateRisks,
  getOpenConstraint,
  Profile,
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

  const usefulPath = /(about|mission|program|service|impact|annual|financial|leadership|team|who-we-are|what-we-do|strategy|report)/i;
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
          "Operational risk should be interpreted from the highest section scores once the full assessment is completed.",
          "Incomplete assessment data limits the specificity of the top-risk diagnosis.",
          "The report will become more precise as more scored responses are provided."
        ],
    recommendations: recommendation.actions,
    fitProofEngagement: recommendation.cta,
    publicSignals: sourceSignals.length ? sourceSignals : ["No AI-enriched public website signals were available for this report."],
    sources: sources.map((source) => ({ title: source.title, url: source.url }))
  };
}

function buildPrompt(profile: Profile, responses: Responses, result: AssessmentResult, sources: SourcePage[]) {
  const sourceText = sources
    .map((source, index) => `SOURCE ${index + 1}: ${source.title}\nURL: ${source.url}\nTEXT: ${source.text}`)
    .join("\n\n");

  return `Create an executive operational strain report for FitProof.

Rules:
- Use the deterministic scoring as authoritative. Do not change scores, stage, weights, or flags.
- Use public website source text only as supporting context. Do not invent facts.
- Write concise executive language for nonprofit leadership.
- Return only valid JSON with this exact shape:
{
  "executiveSummary": "string",
  "organizationSnapshot": "string",
  "strainDiagnosis": "string",
  "missionImplications": "string",
  "topRisks": ["string", "string", "string"],
  "recommendations": ["string", "string", "string", "string", "string"],
  "fitProofEngagement": "string",
  "publicSignals": ["string", "string", "string"]
}

Organization:
${profile.organization || "Unknown organization"}
Website:
${profile.websiteUrl || "No website provided"}

Assessment result:
${JSON.stringify(result, null, 2)}

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
