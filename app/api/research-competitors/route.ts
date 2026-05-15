import { NextRequest, NextResponse } from "next/server";
import { CompetitorResearchResult } from "@/lib/competitor-research";

export const dynamic = "force-dynamic";

type ResearchPayload = {
  productDescription?: string;
  problemSolved?: string;
  targetCustomer?: string;
  marketCategory?: string;
  currentAlternatives?: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const blockedDomains = [
  "duckduckgo.com",
  "google.com",
  "bing.com",
  "linkedin.com",
  "youtube.com",
  "facebook.com",
  "x.com",
  "twitter.com"
];

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoUrl(value: string) {
  try {
    const url = new URL(value, "https://duckduckgo.com");
    const encoded = url.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : url.href;
  } catch {
    return value;
  }
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getName(title: string, domain: string) {
  const cleaned = title
    .replace(/\s+[|-]\s+.*$/g, "")
    .replace(/\b(alternatives|reviews|pricing|competitors|comparison)\b.*$/i, "")
    .trim();

  if (cleaned && cleaned.length <= 48) return cleaned;
  return domain.split(".")[0]?.replace(/-/g, " ") || title.slice(0, 48);
}

function buildQueries(payload: ResearchPayload) {
  const category = payload.marketCategory?.trim();
  const problem = payload.problemSolved?.trim();
  const customer = payload.targetCustomer?.trim();
  const description = payload.productDescription?.trim();
  const alternatives = payload.currentAlternatives?.trim();

  return [
    [category, customer, "software competitors"].filter(Boolean).join(" "),
    [problem, "software alternatives"].filter(Boolean).join(" "),
    [description, "competitors"].filter(Boolean).join(" "),
    [alternatives, category, "alternatives"].filter(Boolean).join(" ")
  ]
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query, index, queries) => query.length > 12 && queries.indexOf(query) === index)
    .slice(0, 4);
}

function parseDuckDuckGo(html: string): SearchResult[] {
  const resultBlocks = html.match(/<div class="result results_links[^"]*">[\s\S]*?<\/div>\s*<\/div>/g) || [];

  return resultBlocks
    .map((block) => {
      const linkMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const url = linkMatch ? decodeDuckDuckGoUrl(linkMatch[1]) : "";
      return {
        title: stripHtml(linkMatch?.[2] || ""),
        url,
        snippet: stripHtml(snippetMatch?.[1] || "")
      };
    })
    .filter((result) => result.title && result.url);
}

async function searchWeb(query: string) {
  const response = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "FitProof market research assistant"
    },
    body: new URLSearchParams({ q: query }).toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  return parseDuckDuckGo(await response.text());
}

function toResearchResult(result: SearchResult, index: number): CompetitorResearchResult | null {
  const domain = getDomain(result.url);
  if (!domain || blockedDomains.some((blocked) => domain.endsWith(blocked))) return null;

  const name = getName(result.title, domain);
  const summary = result.snippet || result.title;
  return {
    id: `${domain}-${index}`,
    name,
    domain,
    url: result.url,
    summary,
    fitReason: `Likely relevant because it appears in searches around the described category, buyer problem, or current alternatives. Validate whether buyers treat it as a direct competitor, indirect substitute, or status quo option.`
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ResearchPayload;
    const queries = buildQueries(payload);

    if (!queries.length) {
      return NextResponse.json(
        { error: "Add a product description, problem, market category, or target customer before researching competitors." },
        { status: 400 }
      );
    }

    const searchResults = (await Promise.all(queries.map(searchWeb))).flat();
    const seen = new Set<string>();
    const results = searchResults
      .map(toResearchResult)
      .filter((result): result is CompetitorResearchResult => Boolean(result))
      .filter((result) => {
        const key = `${result.domain}:${result.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);

    return NextResponse.json({ queries, results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Competitor research failed. Try again with a more specific product description or category."
      },
      { status: 500 }
    );
  }
}
