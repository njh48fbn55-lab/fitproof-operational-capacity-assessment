import { SourceDocument, WebsiteAnalysis } from "./types";
import { extractLinks, fetchTextPage, makeId, normalizeUrl, nowIso } from "./utils";

const analysisLinks = /(about|mission|program|service|impact|annual|financial|leadership|team|board|strategy|report|donate|funders|partners)/i;

export async function websiteAnalysisService(website?: string | null): Promise<WebsiteAnalysis> {
  const url = normalizeUrl(website || "");
  if (!url) return emptyWebsiteAnalysis();

  const home = await fetchTextPage(url, 4000);
  if (!home) return emptyWebsiteAnalysis();

  const links = home.html ? extractLinks(home.html, url, analysisLinks, 8) : [];
  const pages = [home, ...(await Promise.all(links.map((link) => fetchTextPage(link, 3500)))).filter((page): page is NonNullable<typeof home> => Boolean(page))];
  const combined = pages.map((page) => page.text).join("\n\n").slice(0, 16000);
  const sources: SourceDocument[] = pages.map((page) => ({
    id: makeId("source", page.url),
    title: page.title,
    url: page.url,
    sourceType: "website",
    confidence: "medium",
    extractionMethod: "website",
    retrievedAt: nowIso(),
    textExcerpt: page.text.slice(0, 1200)
  }));

  return {
    missionStatement: firstMatch(combined, /(mission(?: is|:)?\s+.{40,260})/i),
    programDescriptions: collectSentences(combined, /(program|services|workforce|housing|education|employment|behavioral|community)/i, 5),
    leadershipTeam: collectNames(combined, /(chief executive|ceo|president|executive director|chief operating|chief financial|leadership)/i),
    boardMembers: collectNames(combined, /(board of directors|trustees|board member|chair)/i),
    donationCta: firstMatch(combined, /(donate[^.]{0,160})/i),
    annualReportLinks: links.filter((link) => /annual|impact|report/i.test(link)),
    auditFinancialLinks: links.filter((link) => /audit|financial|990|form-990/i.test(link)),
    strategicPriorities: collectSentences(combined, /(strategic|priority|plan|growth|expansion|initiative)/i, 5),
    majorFunders: collectSentences(combined, /(funder|foundation|grant|sponsor|partner|support provided by)/i, 5),
    programExpansionSignals: collectSentences(combined, /(expand|expansion|launch|new program|growth|opened|increased demand)/i, 5),
    operationalComplexitySignals: collectSentences(combined, /(locations|counties|statewide|multi-site|contracts|government|workforce|case management|compliance)/i, 6),
    sources
  };
}

function emptyWebsiteAnalysis(): WebsiteAnalysis {
  return {
    missionStatement: null,
    programDescriptions: [],
    leadershipTeam: [],
    boardMembers: [],
    donationCta: null,
    annualReportLinks: [],
    auditFinancialLinks: [],
    strategicPriorities: [],
    majorFunders: [],
    programExpansionSignals: [],
    operationalComplexitySignals: [],
    sources: []
  };
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function collectSentences(text: string, pattern: RegExp, limit: number) {
  const seen = new Set<string>();
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 45 && sentence.length < 260 && pattern.test(sentence))
    .filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function collectNames(text: string, contextPattern: RegExp) {
  const context = collectSentences(text, contextPattern, 8).join(" ");
  const names = context.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || [];
  return [...new Set(names)].slice(0, 10);
}
