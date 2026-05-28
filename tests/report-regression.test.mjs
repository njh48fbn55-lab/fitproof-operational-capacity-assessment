import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const synthesis = readFileSync(new URL("../lib/operational-intelligence/report-synthesis-service.ts", import.meta.url), "utf8");
const crawler = readFileSync(new URL("../lib/workforce-capacity/careers-crawler-service.ts", import.meta.url), "utf8");
const staffingMetrics = readFileSync(new URL("../lib/workforce-capacity/staffing-metrics-service.ts", import.meta.url), "utf8");
const capacity = readFileSync(new URL("../lib/operational-capacity.ts", import.meta.url), "utf8");
const annualReport = readFileSync(new URL("../lib/nonprofit-viability/annual-report-service.ts", import.meta.url), "utf8");
const websiteSophistication = readFileSync(new URL("../lib/nonprofit-viability/website-sophistication-service.ts", import.meta.url), "utf8");
const gauge = readFileSync(new URL("../lib/report-gauge.ts", import.meta.url), "utf8");

test("report no longer renders the legacy duplicate executive summary block for intelligence reports", () => {
  assert.equal(page.includes("<h2>Executive Summary</h2>\\n          <p>${escapeHtml(summary)}</p>"), false);
  assert.match(page, /intelligence\.executiveSummaryParagraphs/);
});

test("gauge rotation uses the actual score value", () => {
  assert.match(gauge, /function scoreToGaugeRotation/);
  assert.match(gauge, /return -90 \+ \(clamped \/ 100\) \* 180;/);
  assert.equal(page.includes("100 - clamped"), false);
});

test("gauge rotation math clamps scores and handles missing values", () => {
  const scoreToGaugeRotation = (score) => {
    if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
    const clamped = Math.max(0, Math.min(100, Number(score)));
    return -90 + (clamped / 100) * 180;
  };
  assert.equal(scoreToGaugeRotation(0), -90);
  assert.equal(scoreToGaugeRotation(50), 0);
  assert.equal(scoreToGaugeRotation(100), 90);
  assert.equal(Math.round(scoreToGaugeRotation(52) * 10) / 10, 3.6);
  assert.equal(scoreToGaugeRotation(125), 90);
  assert.equal(scoreToGaugeRotation(undefined), null);
  assert.match(page, /transform={`rotate\(\$\{angle\} 120 112\)`}/);
});

test("raw growth-constraint labels are not emitted as recommendations", () => {
  assert.equal(synthesis.includes("Address growth constraint:"), false);
  assert.match(synthesis, /function rewriteConstraintAsAction/);
});

test("unreliable liquidity metrics are guarded out of the main report", () => {
  assert.match(synthesis, /hasReliableMetric\(latest, "monthsCashOnHand"\)/);
  assert.match(synthesis, /hasReliableMetric\(latest, "currentRatio"\)/);
  assert.equal(synthesis.includes('kpi("Months Cash on Hand", monthsCash === null ? "Unavailable"'), false);
});

test("workforce count can use ATS extraction and exposes debug counts", () => {
  assert.match(crawler, /if \(\["adp", "workday", "bamboohr", "jazzhr", "paylocity", "icims"\]\.includes\(platform\)\) return fetchGenericAtsRoles/);
  assert.match(crawler, /postingsExtracted: activeRoles\.length/);
  assert.match(crawler, /postingsAfterDeduplication: dedupedRoles\.length/);
});

test("executive summary avoids raw recommendation labels", () => {
  assert.equal(synthesis.includes("The improvement path is to focus on ${priorities"), false);
  assert.match(synthesis, /naturalList\(priorities\.slice\(0, 3\)\)/);
});

test("context section is removed and demand is scored under mission strain", () => {
  assert.equal(capacity.includes('title: "Operational Complexity Context"'), false);
  assert.match(capacity, /id: "demand-change", domainId: "sustainability"/);
});

test("question 31 restructuring prompt is removed while legacy responses remain harmless", () => {
  assert.equal(capacity.includes('id: "restructuring-risk", domainId: "sustainability"'), false);
  assert.match(capacity, /responses\["restructuring-risk"\]/);
});

test("core systems uses two-stage tool mapping and does not score vendor choice directly", () => {
  assert.match(capacity, /type: "systems-map"/);
  assert.match(page, /function SystemsMappingInput/);
  assert.match(capacity, /riskForSystemMapping/);
  assert.equal(capacity.includes("Blackbaud Raiser’s Edge NXT\", risk"), false);
});

test("core systems supports multiselect tools and keeps none or unknown exclusive", () => {
  assert.match(capacity, /tools\?: Partial<Record<SystemCategory, string \| string\[\]>>/);
  assert.match(page, /const exclusive = value === "None" \|\| value === "I don't know"/);
  assert.match(page, /existing\.filter\(\(item\) => item !== "None" && item !== "I don't know"\)/);
  assert.equal(page.includes("Which system is considered the source of truth?"), false);
  assert.equal(page.includes("Where does duplicate data entry most often occur?"), false);
});

test("low-information free text is ignored for additional context", () => {
  assert.match(capacity, /isMeaningfulActionableText/);
  assert.match(capacity, /not sure\|unsure\|n\\\/a\|na\|none/);
});

test("annual report service scans public website reports and reports not found clearly", () => {
  assert.match(annualReport, /annual report not found from public website scan/);
  assert.match(annualReport, /AnnualReportSophisticationScore/);
  assert.match(synthesis, /annualReportInsight/);
});

test("Q4 and Q25 show select all language and Q27 demand wording is updated", () => {
  assert.match(capacity, /Which major operational workflows create the most friction for your team\? Select all that apply\./);
  assert.match(capacity, /What makes board reporting difficult\? Select all that apply\./);
  assert.match(capacity, /How has demand for your services changed over the past 12 months\?/);
  assert.match(capacity, /Increased somewhat/);
  assert.match(capacity, /Stayed about the same/);
});

test("help text is question-specific and not reused across every question", () => {
  const helpEntries = [...capacity.matchAll(/"([^"]+)": "([^"]+)"/g)].filter(([, key]) => key.includes("-"));
  const helpValues = helpEntries.map(([, , value]) => value);
  assert.ok(helpValues.length >= 25);
  assert.ok(new Set(helpValues).size >= 25);
});

test("branded loading screen copy appears during analysis", () => {
  assert.match(page, /Building your operational intelligence report/);
  assert.match(page, /FitProof is gathering public financial, workforce, website, and assessment signals/);
  assert.match(page, /Reviewing assessment responses/);
});

test("website sophistication score is generated when website content exists", () => {
  assert.match(websiteSophistication, /WebsiteSophisticationAnalysis/);
  assert.match(websiteSophistication, /donationPathwayClarity/);
  assert.match(synthesis, /websitePresenceAssessment/);
});

test("public reporting sophistication score is generated when reports are found", () => {
  assert.match(annualReport, /scoreAnnualReport/);
  assert.match(page, /Public Reporting Sophistication Score/);
  assert.match(synthesis, /Public Reporting Sophistication Score/);
});

test("requisition age uses postedDate, then firstSeenAt, and stays unavailable without dates", () => {
  assert.match(staffingMetrics, /const raw = role\.postedDate \|\| role\.firstSeenAt/);
  assert.equal(staffingMetrics.includes("updatedDate || role.firstSeenAt"), false);
  assert.match(staffingMetrics, /if \(!raw\) return null/);
});

test("PDF uses the same rendered gauge component and export labels are simplified", () => {
  assert.match(page, /clonedReport\.outerHTML/);
  assert.match(page, /querySelectorAll\("details"\)\.forEach\(\(details\) => details\.setAttribute\("open", "open"\)\)/);
  assert.match(page, /getLogoDataUri/);
  assert.match(page, /Download PDF/);
  assert.match(page, /Download Word Document/);
  assert.equal(page.includes("Download Branded PDF"), false);
  assert.equal(page.includes("Download Branded Word Document"), false);
});

test("loading state hides unfinished report visuals", () => {
  assert.match(page, /const showLoadingOnly = isGeneratingReport && !generatedReport/);
  assert.match(page, /!showLoadingOnly && intelligence/);
});

test("export and web charts include requested labels and values", () => {
  assert.match(page, /P\/L/);
  assert.match(page, /shortAxisLabel/);
  assert.match(page, /wordRevenueTrendHtml/);
  assert.match(page, /wordRadarHtml/);
  assert.match(page, /\{category\} -/);
  assert.match(page, /gauge-section/);
});
