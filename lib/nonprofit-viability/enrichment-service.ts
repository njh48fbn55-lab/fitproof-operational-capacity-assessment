import { extractAuditFieldsFromSourceUrl, findAuditDocumentsOnWebsite } from "./audit-document-service";
import { financialTrendService } from "./financial-trend-service";
import { irs990Service } from "./irs990-service";
import { nonprofitSearchService } from "./nonprofit-search-service";
import { propublicaService } from "./propublica-service";
import { publicRecordsService } from "./public-records-service";
import { reportGeneratorService } from "./report-generator-service";
import { stateRegistryService } from "./state-registry-service";
import { EnhancedAnalysisRequest, EnhancedAnalysisResult, SourceDocument } from "./types";
import { viabilityScoringService } from "./viability-scoring-service";
import { websiteAnalysisService } from "./website-analysis-service";
import { makeId, normalizeEin, nowIso, writeJsonRecord } from "./utils";

export async function nonprofitEnrichmentService(request: EnhancedAnalysisRequest): Promise<EnhancedAnalysisResult> {
  const organization = await nonprofitSearchService(request);
  const inferredEin = normalizeEin(organization.ein || request.ein);
  const enrichedRequest = {
    ...request,
    name: organization.legalName || request.name,
    ein: inferredEin || request.ein,
    state: organization.state || request.state,
    website: organization.website || request.website
  };
  const [form990Years, propublicaFallback, websiteAnalysis, websiteAuditSources, registryResults, publicRecords] = await Promise.all([
    irs990Service(enrichedRequest),
    propublicaService(enrichedRequest),
    websiteAnalysisService(enrichedRequest.website),
    findAuditDocumentsOnWebsite(enrichedRequest.website),
    stateRegistryService(enrichedRequest.name, enrichedRequest.state, request.includeStateRegistrySearch ?? true),
    publicRecordsService(
      enrichedRequest,
      request.includePublicRecordsSearch ?? true
    )
  ]);

  const sourceMap = new Map<string, SourceDocument>();
  [
    ...organization.sources,
    ...websiteAnalysis.sources,
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
    await Promise.all(websiteAuditSources.slice(0, 3).map((source) => extractAuditFieldsFromSourceUrl(source)))
  ).filter((extraction): extraction is NonNullable<typeof extraction> => Boolean(extraction));
  const auditExtractions = [...(request.uploadedAuditExtractions || []), ...websiteAuditExtractions];
  auditExtractions.forEach((extraction) => sourceMap.set(extraction.sourceDocument.id, extraction.sourceDocument));

  const financialYears = financialTrendService(form990Years.length ? form990Years : propublicaFallback.financialYears, auditExtractions);
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
    registryResults,
    publicRecords,
    financialYears,
    viabilityScore,
    report
  };

  await writeJsonRecord("enhanced-analyses", `${makeId("analysis", organization.ein || organization.legalName || "organization")}.json`, result).catch(() => undefined);
  return result;
}
