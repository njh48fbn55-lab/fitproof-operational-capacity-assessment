import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditExtraction, FinancialMetric, SourceDocument } from "./types";
import { extractLinks, fetchTextPage, fiscalYearFromText, localDataDir, makeId, metricLabel, moneyFromText, normalizeUrl, nowIso, roughTextFromBytes } from "./utils";

const auditLinkPattern = /(audit|audited|financial|annual|990|form-990|report).*\.(pdf|html?)$/i;

export async function saveUploadedAuditDocument(file: File, organizationName: string) {
  const dir = path.join(localDataDir(), "uploads");
  await mkdir(dir, { recursive: true });
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const filePath = path.join(dir, `${Date.now()}-${safeName}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  const sourceDocument: SourceDocument = {
    id: makeId("source", `${organizationName}-${file.name}`),
    title: file.name,
    filePath,
    sourceType: "uploaded_audit",
    confidence: "high",
    extractionMethod: "manual upload",
    retrievedAt: nowIso(),
    notes: "Uploaded by assessment user. Audited financial statements are treated as highest-priority source when extractable."
  };

  return { sourceDocument, bytes };
}

export async function findAuditDocumentsOnWebsite(website?: string | null): Promise<SourceDocument[]> {
  const url = normalizeUrl(website || "");
  if (!url) return [];

  const home = await fetchTextPage(url, 4000);
  if (!home?.html) return [];

  return extractLinks(home.html, url, auditLinkPattern, 8).map((link) => ({
    id: makeId("source", link),
    title: link.split("/").pop() || "Financial document",
    url: link,
    sourceType: "website_audit",
    confidence: "medium",
    extractionMethod: "website",
    retrievedAt: nowIso(),
    notes: "Potential audit, annual report, Form 990, or financial document discovered on the nonprofit website."
  }));
}

export async function extractAuditFieldsFromSourceUrl(sourceDocument: SourceDocument): Promise<AuditExtraction | null> {
  if (!sourceDocument.url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(sourceDocument.url, {
      headers: { "User-Agent": "FitProof Nonprofit Viability Analyzer/1.0" },
      signal: controller.signal
    });
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    const text = roughTextFromBytes(bytes);
    if (text.length < 200) return null;

    return extractAuditFieldsFromText(text, { ...sourceDocument, extractionMethod: "audit" }, fiscalYearFromText(text));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractAuditFieldsFromText(text: string, sourceDocument: SourceDocument, fiscalYear = new Date().getFullYear()): Promise<AuditExtraction> {
  const fields = {
    cashAndCashEquivalents: metric("cashAndInvestments", moneyFromText(text, /cash(?: and cash equivalents)?[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    currentAssets: metric("currentAssets", moneyFromText(text, /current assets[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    currentLiabilities: metric("currentLiabilities", moneyFromText(text, /current liabilities[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    totalAssets: metric("totalAssets", moneyFromText(text, /total assets[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    totalLiabilities: metric("totalLiabilities", moneyFromText(text, /total liabilities[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    netAssetsWithDonorRestrictions: metric("netAssetsWithDonorRestrictions", moneyFromText(text, /with donor restrictions[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    netAssetsWithoutDonorRestrictions: metric("netAssetsWithoutDonorRestrictions", moneyFromText(text, /without donor restrictions[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    operatingRevenue: metric("totalRevenue", moneyFromText(text, /(?:operating revenue|total revenue|support and revenue)[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    operatingExpenses: metric("totalExpenses", moneyFromText(text, /(?:operating expenses|total expenses)[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    changeInNetAssets: metric("surplusDeficit", moneyFromText(text, /(?:change in net assets|increase in net assets|decrease in net assets)[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    debt: metric("debt", moneyFromText(text, /(?:debt|notes payable|bonds payable)[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument),
    investments: metric("cashAndInvestments", moneyFromText(text, /investments[^$\d-]*\$?\s*([\d,]+)/i), fiscalYear, sourceDocument)
  };

  const lower = text.toLowerCase();
  return {
    sourceDocument,
    fields,
    liquidityNote: excerptAround(text, /liquidity/i),
    goingConcernLanguage: excerptAround(text, /going concern/i),
    auditOpinion: lower.includes("unmodified opinion") || lower.includes("present fairly") ? "Potential clean/unmodified opinion language detected; verify against the audit opinion page." : null,
    materialWeaknessesOrSignificantDeficiencies: excerptAround(text, /material weakness|significant deficiencies|significant deficiency/i),
    extractionNotes: [
      "Regex extraction is conservative and should be verified against the source document.",
      "If a PDF is image-based or table formatting is complex, unavailable fields remain null rather than being inferred."
    ]
  };
}

function metric(name: FinancialMetric["name"], value: number | null, fiscalYear: number, sourceDocument: SourceDocument): FinancialMetric | null {
  return {
    name,
    label: metricLabel(name),
    value,
    fiscalYear,
    source: sourceDocument.title,
    confidence: value === null ? "low" : sourceDocument.confidence,
    extractionMethod: sourceDocument.extractionMethod === "manual upload" ? "manual upload" : "audit",
    sourceNote: value === null ? "Source did not provide this field or it could not be extracted reliably." : undefined
  };
}

function excerptAround(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match?.index) return null;
  return text.slice(Math.max(0, match.index - 220), match.index + 420).replace(/\s+/g, " ").trim();
}
