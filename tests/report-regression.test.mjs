import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const synthesis = readFileSync(new URL("../lib/operational-intelligence/report-synthesis-service.ts", import.meta.url), "utf8");
const crawler = readFileSync(new URL("../lib/workforce-capacity/careers-crawler-service.ts", import.meta.url), "utf8");
const capacity = readFileSync(new URL("../lib/operational-capacity.ts", import.meta.url), "utf8");
const annualReport = readFileSync(new URL("../lib/nonprofit-viability/annual-report-service.ts", import.meta.url), "utf8");

test("report no longer renders the legacy duplicate executive summary block for intelligence reports", () => {
  assert.equal(page.includes("<h2>Executive Summary</h2>\\n          <p>${escapeHtml(summary)}</p>"), false);
  assert.match(page, /intelligence\.executiveSummaryParagraphs/);
});

test("gauge rotation uses the actual score value", () => {
  assert.match(page, /function scoreToGaugeRotation\(score: number\)/);
  assert.match(page, /return -90 \+ \(clamped \/ 100\) \* 180;/);
  assert.equal(page.includes("100 - clamped"), false);
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
