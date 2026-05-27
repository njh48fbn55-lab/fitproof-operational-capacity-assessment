import { extractAuditFieldsFromSourceUrl, findAuditDocumentsOnWebsite } from "./audit-document-service";
import { annualReportService } from "./annual-report-service";
import { financialTrendService } from "./financial-trend-service";
import { irs990Service } from "./irs990-service";
import { nonprofitSearchService } from "./nonprofit-search-service";
import { propublicaService } from "./propublica-service";
import { publicRecordsService } from "./public-records-service";
import { reportGeneratorService } from "./report-generator-service";
import { stateRegistryService } from "./state-registry-service";
import { EnhancedAnalysisRequest, EnhancedAnalysisResult, SourceDocument, WebsiteAnalysis } from "./types";
import { viabilityScoringService } from "./viability-scoring-service";
import { websiteAnalysisService } from "./website-analysis-service";
import { websiteSophisticationService } from "./website-sophistication-service";
import { makeId, normalizeEin, nowIso, writeJsonRecord } from "./utils";

export async function nonprofitEnrichmentService(request: EnhancedAnalysisRequest): Promise<EnhancedAnalysisResult> {
  const organization = await safeSource("nonprofit search", nonprofitSearchService(request), {
    id: makeId("org", request.name || request.website || "organization"),
    legalName: request.name || null,
    dbaNames: [],
    ein: request.ein || null,
    state: request.state || null,
    address: null,
    website: request.website || null,
    nteeCode: null,
    exemptionStatus: null,
    sourceConfidence: "low" as const,
    sources: []
  });
  const inferredEin = normalizeEin(organization.ein || request.ein);
  const enrichedRequest = {
    ...request,
    name: organization.legalName || request.name,
    ein: inferredEin || request.ein,
    state: organization.state || request.state,
    website: organization.website || request.website
  };
  const [form990Years, propublicaFallback, websiteAnalysis, annualReportAnalysis, websiteAuditSources, registryResults, publicRecords] = await Promise.all([
    safeSource("IRS 990 enrichment", irs990Service(enrichedRequest), []),
    safeSource("ProPublica enrichment", propublicaService(enrichedRequest), { sources: [], financialYears: [] }),
    safeSource("website analysis", websiteAnalysisService(enrichedRequest.website), emptyWebsiteAnalysis()),
    safeSource("annual report analysis", annualReportService(enrichedRequest.website), emptyAnnualReportAnalysis()),
    safeSource("website audit discovery", findAuditDocumentsOnWebsite(enrichedRequest.website), []),
    safeSource("state registry search", stateRegistryService(enrichedRequest.name, enrichedRequest.state, request.includeStateRegistrySearch ?? true), []),
    safeSource("public records search", publicRecordsService(
      enrichedRequest,
      request.includePublicRecordsSearch ?? true
    ), [])
  ]);

  const sourceMap = new Map<string, SourceDocument>();
  [
    ...organization.sources,
    ...websiteAnalysis.sources,
    ...(annualReportAnalysis.sourceDocument ? [annualReportAnalysis.sourceDocument] : []),
    ...websiteAuditSources,
    ...registryResults.flatMap((result) => result.sources),
    ...propublicaFallback.sources
  ].forEach((source) => sourceMap.set(source.id, source));

  publicRecords.forEach((record) => {
    if (!record.url) return;
    const source: SourceDocument = {
      id: makeId("source", record.url),
      title: record.title,
      url: record.url,
      sourceType: "public_record",
      confidence: record.confidence,
      extractionMethod: "public record",
      retrievedAt: nowIso(),
      notes: record.relevance
    };
    sourceMap.set(source.id, source);
  });

  const websiteAuditExtractions = (
    await Promise.all(websiteAuditSources.slice(0, 2).map((source) => safeSource("website audit extraction", extractAuditFieldsFromSourceUrl(source), null)))
  ).filter((extraction): extraction is NonNullable<typeof extraction> => Boolean(extraction));
  const auditExtractions = [...(request.uploadedAuditExtractions || []), ...websiteAuditExtractions];
  auditExtractions.forEach((extraction) => sourceMap.set(extraction.sourceDocument.id, extraction.sourceDocument));

  const financialYears = financialTrendService(form990Years.length ? form990Years : propublicaFallback.financialYears, auditExtractions);
  const websiteSophistication = websiteSophisticationService(websiteAnalysis);
  const viabilityScore = viabilityScoringService(financialYears, websiteAnalysis, registryResults, publicRecords);
  const sources = [...sourceMap.values()];
  const report = await reportGeneratorService({
    organization,
    sources,
    financialYears,
    viabilityScore,
    websiteAnalysis,
    registryResults,
    publicRecords
  });

  const result: EnhancedAnalysisResult = {
    organization,
    sources,
    websiteAnalysis,
    websiteSophistication,
    annualReportAnalysis,
    registryResults,
    publicRecords,
    financialYears,
    viabilityScore,
    report
  };

  await writeJsonRecord("enhanced-analyses", `${makeId("analysis", organization.ein || organization.legalName || "organization")}.json`, result).catch(() => undefined);
  return result;
}

function emptyAnnualReportAnalysis() {
  return {
    status: "not_found" as const,
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
    notes: ["annual report not found from public website scan."]
  };
}

async function safeSource<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`${label} failed during enhanced analysis`, error);
    return fallback;
  }
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
