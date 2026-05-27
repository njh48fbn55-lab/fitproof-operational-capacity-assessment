import { EnhancedAnalysisResult, FinancialYear, Organization, PublicRecordSignal, RegistrySearchResult, SourceDocument, ViabilityScore, WebsiteAnalysis } from "./types";
import { makeId, nowIso, writeJsonRecord } from "./utils";

export async function reportGeneratorService({
  organization,
  sources,
  financialYears,
  viabilityScore,
  websiteAnalysis,
  registryResults,
  publicRecords
}: {
  organization: Organization;
  sources: SourceDocument[];
  financialYears: FinancialYear[];
  viabilityScore: ViabilityScore;
  websiteAnalysis: WebsiteAnalysis;
  registryResults: RegistrySearchResult[];
  publicRecords: PublicRecordSignal[];
}) {
  const narrative = await synthesizeWithOpenAI(organization, financialYears, viabilityScore, websiteAnalysis, registryResults, publicRecords).catch(() => null);
  const report = {
    organizationId: organization.id,
    generatedAt: nowIso(),
    organizationProfile: organization,
    sources,
    financialYears,
    viabilityScore,
    executiveNarrative: narrative?.executiveNarrative || `${organization.legalName || "The organization"} has a viability score of ${viabilityScore.total}/100 (${viabilityScore.classification}). Metrics with unavailable source data are intentionally left null and should be filled from audits or Form 990 records before relying on the analysis for underwriting or board decisions.`,
    revenueExpenseTrendNarrative: narrative?.revenueExpenseTrendNarrative || "Revenue and expense trend interpretation is based on the available normalized financial years. Missing fields indicate the source did not provide enough structured detail.",
    surplusDeficitAnalysis: narrative?.surplusDeficitAnalysis || "Surplus/deficit analysis should focus on recurring deficits, volatility, and whether expense growth is outpacing revenue growth.",
    liquidityRunwayAnalysis: narrative?.liquidityRunwayAnalysis || "Liquidity analysis uses current ratio and months cash on hand when available. Null values mean current assets, current liabilities, cash, or expense detail were not available.",
    restrictedNetAssetAnalysis: narrative?.restrictedNetAssetAnalysis || "Restricted versus unrestricted net asset split is only available when provided by audited financial statements or sufficiently detailed filings.",
    complianceGovernanceObservations: narrative?.complianceGovernanceObservations || "Compliance and governance observations are limited to available state registry, IRS, and public record signals.",
    recommendedFitProofNextSteps: narrative?.recommendedFitProofNextSteps || ["Validate missing financial metrics against audited statements.", "Review liquidity, deficit, and expense growth flags.", "Prioritize operational improvements tied to the highest viability risks."],
    operationalOptimizationOpportunities: narrative?.operationalOptimizationOpportunities || ["Centralize reporting source data.", "Reduce manual financial reporting reconciliation.", "Create a recurring viability dashboard."],
    aiAutomationOpportunities: narrative?.aiAutomationOpportunities || ["Automate Form 990/audit metric extraction review.", "Monitor public records and funding signals.", "Generate board-ready variance summaries."],
    riskFlags: viabilityScore.riskFlags
  };

  await writeJsonRecord("reports", `${makeId("report", organization.ein || organization.legalName || "organization")}.json`, report).catch(() => undefined);
  return report;
}

async function synthesizeWithOpenAI(
  organization: Organization,
  financialYears: FinancialYear[],
  viabilityScore: ViabilityScore,
  websiteAnalysis: WebsiteAnalysis,
  registryResults: RegistrySearchResult[],
  publicRecords: PublicRecordSignal[]
) {
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
      input: `Generate a nonprofit viability executive report from computed backend data. Do not invent financial values. If a field is null, explain that the source did not provide it.\n\nOrganization:\n${JSON.stringify(organization, null, 2)}\n\nFinancial years:\n${JSON.stringify(financialYears, null, 2)}\n\nViability score:\n${JSON.stringify(viabilityScore, null, 2)}\n\nWebsite analysis:\n${JSON.stringify(websiteAnalysis, null, 2)}\n\nRegistry results:\n${JSON.stringify(registryResults, null, 2)}\n\nPublic records:\n${JSON.stringify(publicRecords, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "fitproof_viability_report",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "executiveNarrative",
              "revenueExpenseTrendNarrative",
              "surplusDeficitAnalysis",
              "liquidityRunwayAnalysis",
              "restrictedNetAssetAnalysis",
              "complianceGovernanceObservations",
              "recommendedFitProofNextSteps",
              "operationalOptimizationOpportunities",
              "aiAutomationOpportunities"
            ],
            properties: {
              executiveNarrative: { type: "string" },
              revenueExpenseTrendNarrative: { type: "string" },
              surplusDeficitAnalysis: { type: "string" },
              liquidityRunwayAnalysis: { type: "string" },
              restrictedNetAssetAnalysis: { type: "string" },
              complianceGovernanceObservations: { type: "string" },
              recommendedFitProofNextSteps: { type: "array", items: { type: "string" } },
              operationalOptimizationOpportunities: { type: "array", items: { type: "string" } },
              aiAutomationOpportunities: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      temperature: 0.2,
      max_output_tokens: 2200
    })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const text = payload.output_text || "";
  return text ? JSON.parse(text) : null;
}

export function downloadPayload(result: EnhancedAnalysisResult) {
  return JSON.stringify(result.report, null, 2);
}
