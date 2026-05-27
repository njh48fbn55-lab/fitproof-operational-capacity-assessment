import { WebsiteAnalysis, WebsiteSophisticationAnalysis } from "./types";

export function websiteSophisticationService(websiteAnalysis: WebsiteAnalysis): WebsiteSophisticationAnalysis {
  const primaryCallsToAction = collectCtas(websiteAnalysis);
  const donateButtonPresence = websiteAnalysis.donationCta ? (/donate now|give now|make a gift/i.test(websiteAnalysis.donationCta) ? "prominent" : "present") : "not_detected";
  const volunteerCtaPresence = websiteAnalysis.programDescriptions.concat(websiteAnalysis.operationalComplexitySignals).some((item) => /volunteer/i.test(item)) ? "present" : "not_detected";
  const impactMetrics = collectImpactMetrics(websiteAnalysis);
  const leadershipBoardPages = [...websiteAnalysis.leadershipTeam, ...websiteAnalysis.boardMembers];
  const accessibilityIssues = detectAccessibilityIssues(websiteAnalysis);
  const confusingOrMissingPathways = missingPathways({ donateButtonPresence, volunteerCtaPresence, websiteAnalysis, impactMetrics });
  const categories = {
    missionClarity: score(websiteAnalysis.missionStatement ? 2 : 0),
    donationPathwayClarity: donateButtonPresence === "prominent" ? 90 : donateButtonPresence === "present" ? 72 : 35,
    volunteerPathwayClarity: volunteerCtaPresence === "present" ? 75 : 40,
    programServiceClarity: score(websiteAnalysis.programDescriptions.length),
    impactEvidence: score(impactMetrics.length),
    financialTransparencySignals: score(websiteAnalysis.annualReportLinks.length + websiteAnalysis.auditFinancialLinks.length),
    leadershipBoardVisibility: score(leadershipBoardPages.length),
    callsToActionQuality: score(primaryCallsToAction.length),
    mobileUsabilityAccessibilitySignals: accessibilityIssues.length ? 45 : 70
  };
  const totalScore = Math.round(
    categories.missionClarity * 0.15 +
      categories.donationPathwayClarity * 0.15 +
      categories.volunteerPathwayClarity * 0.1 +
      categories.programServiceClarity * 0.15 +
      categories.impactEvidence * 0.15 +
      categories.financialTransparencySignals * 0.1 +
      categories.leadershipBoardVisibility * 0.05 +
      categories.callsToActionQuality * 0.1 +
      categories.mobileUsabilityAccessibilitySignals * 0.05
  );

  return {
    score: {
      totalScore,
      categories,
      strongestSignals: strongest(categories),
      weakestSignals: weakest(categories),
      recommendations: recommendations(confusingOrMissingPathways, categories),
      confidence: websiteAnalysis.sources.length ? "medium" : "low"
    },
    primaryCallsToAction,
    donateButtonPresence,
    volunteerCtaPresence,
    programDescriptions: websiteAnalysis.programDescriptions,
    impactMetrics,
    annualReportLinks: websiteAnalysis.annualReportLinks,
    financialLinks: websiteAnalysis.auditFinancialLinks,
    leadershipBoardPages,
    accessibilityIssues,
    confusingOrMissingPathways,
    notes: websiteAnalysis.sources.length ? [] : ["Website sophistication could not be fully assessed because website content was unavailable."]
  };
}

function collectCtas(analysis: WebsiteAnalysis) {
  const candidates = [
    analysis.donationCta || "",
    ...analysis.programDescriptions,
    ...analysis.strategicPriorities
  ].join(" ");
  return [...new Set((candidates.match(/\b(donate|give|volunteer|refer|apply|enroll|contact us|learn more|get help|partner)\b/gi) || []).map((item) => item.toLowerCase()))].slice(0, 8);
}

function collectImpactMetrics(analysis: WebsiteAnalysis) {
  return [...analysis.programDescriptions, ...analysis.strategicPriorities, ...analysis.programExpansionSignals]
    .filter((item) => /\b\d[\d,.%]*\b|outcome|impact|served|placed|completed|improved|reduced|increased/i.test(item))
    .slice(0, 8);
}

function detectAccessibilityIssues(analysis: WebsiteAnalysis) {
  const text = analysis.sources.map((source) => source.textExcerpt || "").join(" ");
  const issues: string[] = [];
  if (/click here/i.test(text)) issues.push("Generic link text may reduce pathway clarity.");
  if (!analysis.missionStatement) issues.push("Mission statement was not clearly detected.");
  return issues.slice(0, 4);
}

function missingPathways({
  donateButtonPresence,
  volunteerCtaPresence,
  websiteAnalysis,
  impactMetrics
}: {
  donateButtonPresence: WebsiteSophisticationAnalysis["donateButtonPresence"];
  volunteerCtaPresence: WebsiteSophisticationAnalysis["volunteerCtaPresence"];
  websiteAnalysis: WebsiteAnalysis;
  impactMetrics: string[];
}) {
  const missing: string[] = [];
  if (donateButtonPresence === "not_detected") missing.push("Donation pathway was not clearly detected.");
  if (volunteerCtaPresence === "not_detected") missing.push("Volunteer pathway was not clearly detected.");
  if (!websiteAnalysis.programDescriptions.length) missing.push("Program or service pathway detail was limited.");
  if (!impactMetrics.length) missing.push("Impact evidence or measurable outcomes were limited.");
  if (!websiteAnalysis.annualReportLinks.length && !websiteAnalysis.auditFinancialLinks.length) missing.push("Financial transparency links were not clearly detected.");
  return missing;
}

function recommendations(missing: string[], categories: Record<string, number>) {
  const recs = [
    missing.some((item) => /Donation/.test(item)) ? "Make the donation pathway easy to find from the homepage and program pages." : "",
    missing.some((item) => /Volunteer/.test(item)) ? "Clarify the volunteer pathway with a visible call to action and next steps." : "",
    missing.some((item) => /Program/.test(item)) ? "Strengthen program pages so clients, referrers, donors, and funders can quickly understand services." : "",
    missing.some((item) => /Impact/.test(item)) ? "Add measurable outcomes or impact proof points near program and fundraising content." : "",
    missing.some((item) => /Financial/.test(item)) ? "Make annual reports, impact reports, audits, or Form 990 links easier to find." : ""
  ].filter(Boolean);
  if (!recs.length && categories.callsToActionQuality < 75) recs.push("Simplify calls to action so donors, volunteers, referrers, and community partners know the next step.");
  return recs.slice(0, 5);
}

function score(count: number) {
  if (count >= 4) return 90;
  if (count >= 2) return 75;
  if (count === 1) return 58;
  return 35;
}

function strongest(categories: Record<string, number>) {
  return Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => label(key));
}

function weakest(categories: Record<string, number>) {
  return Object.entries(categories).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([key]) => label(key));
}

function label(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
