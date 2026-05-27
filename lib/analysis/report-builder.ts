import { AssessmentResult, GeneratedExecutiveReport, Profile, Responses, generateRisks, stageRecommendations } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { reportSynthesisService } from "@/lib/operational-intelligence/report-synthesis-service";
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
  return synthesizedReport(profile, responses, result, enhancedAnalysis, workforceCapacityAnalysis);
}

function synthesizedReport(profile: Profile, responses: Responses, result: AssessmentResult, enhancedAnalysis: EnhancedAnalysisResult | null, workforceCapacityAnalysis: WorkforceCapacityAnalysis | null): GeneratedExecutiveReport {
  const recommendation = stageRecommendations[result.stage.number];
  const operationalIntelligence = reportSynthesisService({ profile, result, responses, enhancedAnalysis, workforceCapacityAnalysis });
  const financialAnalysis = enhancedAnalysis ? financialNarrative(enhancedAnalysis) : "No public financial trend analysis was available.";
  const strategicSignals = enhancedAnalysis ? strategyNarrative(enhancedAnalysis) : "No website strategy or public signal analysis was available.";
  const staffingCapacityAnalysis = workforceCapacityAnalysis ? staffingNarrative(workforceCapacityAnalysis) : "No public workforce capacity analysis was available.";

  return {
    generated: true,
    operationalIntelligence,
    executiveSummary: operationalIntelligence.executiveSummaryParagraphs.join("\n\n"),
    organizationSnapshot: `${profile.organization || "The organization"}: ${enhancedAnalysis?.organization.legalName || "public profile matched where available"}${enhancedAnalysis?.organization.ein ? `, EIN ${enhancedAnalysis.organization.ein}` : ""}. ${enhancedAnalysis?.organization.nteeCode ? `NTEE ${enhancedAnalysis.organization.nteeCode}.` : ""}`,
    strainDiagnosis: `${operationalIntelligence.operationalStrainSpiral.currentStage} (${operationalIntelligence.operationalStrainSpiral.stageConfidence}% confidence). Primary drivers: ${operationalIntelligence.operationalStrainSpiral.primaryStrainDrivers.slice(0, 3).join(" ")}`,
    missionImplications: `Organizational Health ${operationalIntelligence.organizationalHealthScore.totalScore}/100; Growth Readiness ${operationalIntelligence.growthReadinessScore.score}/100. The priority is to remove the constraints that most directly limit scale, reporting confidence, and execution capacity.`,
    financialAnalysis,
    staffingCapacityAnalysis,
    strategicSignals,
    primaryStrainDrivers: operationalIntelligence.operationalStrainSpiral.primaryStrainDrivers.slice(0, 5).map((driver) => ({
      category: driver.split(":")[0] || "Operational strain",
      strain: driver,
      evidence: "Synthesized from assessment responses, public financials, workforce signals, and operating indicators.",
      whyItMatters: "This is one of the highest-priority constraints affecting operational health or growth readiness.",
      consequence: "If not addressed, this constraint can slow execution, increase manual work, weaken visibility, or limit growth readiness."
    })),
    topRisks: operationalIntelligence.primaryOperationalRisks.length ? operationalIntelligence.primaryOperationalRisks : generateRisks(result),
    recommendations: operationalIntelligence.recommendedPriorities.length ? operationalIntelligence.recommendedPriorities : recommendation.actions,
    fitProofEngagement: recommendation.cta,
    recommendedEngagement: {
      recommendedOffering: recommendation.cta,
      whyThisOfferingFits: `${profile.organization || "The organization"} is classified as ${operationalIntelligence.operationalStrainSpiral.currentStage}, with Growth Readiness at ${operationalIntelligence.growthReadinessScore.score}/100.`,
      primaryObjectives: operationalIntelligence.recommendedPriorities.slice(0, 3),
      initialWorkplan: operationalIntelligence.recommendedPriorities.slice(0, 5),
      expectedOutcomes: ["Clearer executive priorities", "Improved growth readiness", "Reduced operational strain in the highest-impact constraints"],
      suggestedTimeline: operationalIntelligence.growthReadinessScore.score < 50 || result.riskScore >= 75 ? "Immediate 30-60 day stabilization sprint" : "30-60 day operational intelligence sprint",
      whyNow: "The synthesized scores show where public financials, workforce signals, and assessment responses intersect; those constraints should be addressed before new growth adds complexity."
    },
    nextSteps: operationalIntelligence.recommendedPriorities.slice(0, 5),
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
    ...enhancedAnalysis.websiteAnalysis.operationalComplexitySignals,
    ...enhancedAnalysis.annualReportAnalysis.signals.strategicPriorities,
    ...enhancedAnalysis.annualReportAnalysis.signals.growthGoals,
    ...enhancedAnalysis.annualReportAnalysis.signals.operationalWorkforceChallenges,
    ...enhancedAnalysis.annualReportAnalysis.signals.technologyModernizationReferences
  ];
  const annualNote = enhancedAnalysis.annualReportAnalysis.score
    ? `Annual report sophistication score: ${enhancedAnalysis.annualReportAnalysis.score.totalScore}/100.`
    : "annual report not found from public website scan.";
  return signals.length ? `${annualNote} ${signals.slice(0, 5).join(" ")}` : `No clear public strategy or expansion signals were available from the reviewed sources. ${annualNote}`;
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
