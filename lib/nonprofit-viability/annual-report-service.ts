import { AnnualReportAnalysis, AnnualReportSophisticationScore, SourceDocument } from "./types";
import { extractLinks, fetchTextPage, makeId, normalizeUrl, nowIso } from "./utils";

const annualPattern = /(annual[-\s]?report|impact[-\s]?report|community[-\s]?report|donor[-\s]?report|year[-\s]?in[-\s]?review)/i;

export async function annualReportService(website?: string | null): Promise<AnnualReportAnalysis> {
  const url = normalizeUrl(website || "");
  if (!url) return notFound("annual report not found from public website scan.");

  const home = await fetchTextPage(url, 4500);
  if (!home) return notFound("annual report not found from public website scan.");

  const candidates = findAnnualReportLinks(home.html || "", url);
  const preferred = candidates.find((link) => /\.pdf(?:$|\?)/i.test(link)) || candidates[0];
  if (!preferred) return notFound("annual report not found from public website scan.");

  const reportPage = await fetchTextPage(preferred, 6000);
  if (!reportPage?.text) {
    return {
      ...notFound("annual report link was found, but the document could not be read safely."),
      status: "found"
    };
  }

  const excerpt = reportPage.text.slice(0, 50000);
  const sourceDocument: SourceDocument = {
    id: makeId("annual-report", preferred),
    title: reportPage.title || "Annual or impact report",
    url: preferred,
    sourceType: "annual_report",
    confidence: "medium",
    extractionMethod: "annual report",
    retrievedAt: nowIso(),
    notes: "Annual, impact, community, donor, or year-in-review report discovered on public website.",
    textExcerpt: excerpt.slice(0, 2000)
  };

  const signals = {
    strategicPriorities: collect(excerpt, /(strategic|priority|plan|initiative|goal|roadmap)/i, 5),
    measurableOutcomes: collect(excerpt, /(outcome|impact|measured|served|completed|achieved|result)/i, 5),
    programPerformanceMetrics: collect(excerpt, /(program|service|participant|client|enrollment|completion|placement|retention)/i, 5),
    revenueFundingNarrative: collect(excerpt, /(revenue|funding|grant|donor|contract|contribution|earned income)/i, 5),
    donorFunderTransparency: collect(excerpt, /(donor|funder|foundation|sponsor|supporter|partner)/i, 5),
    leadershipBoardTransparency: collect(excerpt, /(board|trustee|leadership|executive|officer|chair)/i, 5),
    dataDashboardReferences: collect(excerpt, /(dashboard|data|analytics|indicator|kpi|metric|reporting)/i, 5),
    multiYearTrendVisibility: collect(excerpt, /(five-year|multi-year|trend|over the past|year over year|compared with)/i, 5),
    operationalWorkforceChallenges: collect(excerpt, /(staffing|workforce|capacity|operational|hiring|turnover|shortage|challenge)/i, 5),
    growthGoals: collect(excerpt, /(grow|growth|expand|expansion|scale|launch|new site|new program)/i, 5),
    technologyModernizationReferences: collect(excerpt, /(technology|modernization|system|digital|automation|platform|crm|database)/i, 5)
  };

  return {
    status: "found",
    sourceDocument,
    score: scoreAnnualReport(signals),
    signals,
    notes: []
  };
}

function findAnnualReportLinks(html: string, baseUrl: string) {
  const urlMatches = extractLinks(html, baseUrl, annualPattern, 20);
  const textMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => annualPattern.test(stripTags(match[2] || "")) || annualPattern.test(match[1] || ""))
    .map((match) => {
      try {
        const url = new URL(match[1], baseUrl);
        url.hash = "";
        return url.toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  return [...new Set([...urlMatches, ...textMatches])].slice(0, 20);
}

function scoreAnnualReport(signals: AnnualReportAnalysis["signals"]): AnnualReportSophisticationScore {
  const categories = {
    outcomeMeasurement: scoreBucket(signals.measurableOutcomes.length),
    financialTransparency: scoreBucket(signals.revenueFundingNarrative.length),
    strategicClarity: scoreBucket(signals.strategicPriorities.length),
    programPerformanceVisibility: scoreBucket(signals.programPerformanceMetrics.length),
    governanceLeadershipTransparency: scoreBucket(signals.leadershipBoardTransparency.length),
    growthOperationalMaturitySignals: scoreBucket(signals.growthGoals.length + signals.operationalWorkforceChallenges.length),
    dataReportingMaturity: scoreBucket(signals.dataDashboardReferences.length + signals.multiYearTrendVisibility.length)
  };

  const totalScore = Math.round(
    categories.outcomeMeasurement * 0.2 +
      categories.financialTransparency * 0.2 +
      categories.strategicClarity * 0.2 +
      categories.programPerformanceVisibility * 0.15 +
      categories.governanceLeadershipTransparency * 0.1 +
      categories.growthOperationalMaturitySignals * 0.1 +
      categories.dataReportingMaturity * 0.05
  );

  const findings = [
    categories.outcomeMeasurement >= 70 ? "Annual report includes measurable outcome signals." : "Annual report shows limited measurable outcome detail.",
    categories.financialTransparency >= 70 ? "Annual report includes revenue or funding narrative." : "Annual report financial transparency signals appear limited.",
    categories.strategicClarity >= 70 ? "Annual report includes strategic priority or growth signals." : "Annual report strategic clarity signals appear limited."
  ];

  return { totalScore, categories, findings, confidence: "medium" };
}

function scoreBucket(count: number) {
  if (count >= 4) return 90;
  if (count >= 2) return 72;
  if (count === 1) return 55;
  return 35;
}

function collect(text: string, pattern: RegExp, limit: number) {
  const seen = new Set<string>();
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 45 && sentence.length < 280 && pattern.test(sentence))
    .filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function notFound(note: string): AnnualReportAnalysis {
  return {
    status: "not_found",
    sourceDocument: null,
    score: null,
    signals: {
      strategicPriorities: [],
      measurableOutcomes: [],
      programPerformanceMetrics: [],
      revenueFundingNarrative: [],
      donorFunderTransparency: [],
      leadershipBoardTransparency: [],
      dataDashboardReferences: [],
      multiYearTrendVisibility: [],
      operationalWorkforceChallenges: [],
      growthGoals: [],
      technologyModernizationReferences: []
    },
    notes: [note]
  };
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
