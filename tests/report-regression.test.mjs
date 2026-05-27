import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const synthesis = readFileSync(new URL("../lib/operational-intelligence/report-synthesis-service.ts", import.meta.url), "utf8");
const crawler = readFileSync(new URL("../lib/workforce-capacity/careers-crawler-service.ts", import.meta.url), "utf8");

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
