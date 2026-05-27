import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditExtraction, ExtractionMethod, FinancialMetric, SourceDocument, ViabilitySourceType } from "./types";
import { extractLinks, fetchTextPage, fiscalYearFromText, localDataDir, makeId, metricLabel, moneyFromText, normalizeUrl, nowIso, roughTextFromBytes } from "./utils";

const auditLinkPattern = /(audit|audited|financial|finance|annual|impact|990|form-990|report|transparency|accountability)/i;

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

  const links = [
    ...extractLinks(home.html, url, auditLinkPattern, 8),
    ...extractFinancialLinksByAnchor(home.html, url, 10)
  ];

  const secondLevelPages = (
    await Promise.all([...new Set(links)].slice(0, 5).map((link) => fetchTextPage(link, 3500)))
  ).filter((page): page is NonNullable<typeof home> => Boolean(page?.html));

  const deeperLinks = secondLevelPages.flatMap((page) => [
    ...extractLinks(page.html, page.url, auditLinkPattern, 6),
    ...extractFinancialLinksByAnchor(page.html, page.url, 6)
  ]);

  return [...new Set([...links, ...deeperLinks])].slice(0, 12).map((link) => ({
    id: makeId("source", link),
    title: financialTitleFromUrl(link),
    url: link,
    sourceType: sourceTypeFromUrl(link),
    confidence: "medium",
    extractionMethod: extractionMethodFromUrl(link),
    retrievedAt: nowIso(),
    notes: "Potential audit, annual report, impact report, Form 990, or financial disclosure discovered on the nonprofit website."
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

    return extractAuditFieldsFromText(text, sourceDocument, fiscalYearFromText(text));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractAuditFieldsFromText(text: string, sourceDocument: SourceDocument, fiscalYear = new Date().getFullYear()): Promise<AuditExtraction> {
  const fields = {
    cashAndCashEquivalents: metric("cashAndInvestments", moneyFromText(text, /cash(?: and cash equivalents)?[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    currentAssets: metric("currentAssets", moneyFromText(text, /current assets[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    currentLiabilities: metric("currentLiabilities", moneyFromText(text, /current liabilities[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    totalAssets: metric("totalAssets", moneyFromText(text, /total assets[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    totalLiabilities: metric("totalLiabilities", moneyFromText(text, /total liabilities[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    netAssetsWithDonorRestrictions: metric("netAssetsWithDonorRestrictions", moneyFromText(text, /with donor restrictions[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    netAssetsWithoutDonorRestrictions: metric("netAssetsWithoutDonorRestrictions", moneyFromText(text, /without donor restrictions[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    operatingRevenue: metric("totalRevenue", moneyFromText(text, /(?:operating revenue|total revenue|total support|support and revenue|revenues?)[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    operatingExpenses: metric("totalExpenses", moneyFromText(text, /(?:operating expenses|total expenses|expenses?)[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    changeInNetAssets: metric("surplusDeficit", moneyFromText(text, /(?:change in net assets|increase in net assets|decrease in net assets|surplus|deficit)[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    debt: metric("debt", moneyFromText(text, /(?:debt|notes payable|bonds payable)[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument),
    investments: metric("cashAndInvestments", moneyFromText(text, /investments[^$\d(.-]*\$?\s*(\(?-?[\d,.]+\)?)/i), fiscalYear, sourceDocument)
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
    extractionMethod: metricExtractionMethod(sourceDocument),
    sourceNote: value === null ? "Source did not provide this field or it could not be extracted reliably." : undefined
  };
}

function extractFinancialLinksByAnchor(html: string, baseUrl: string, limit: number) {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      try {
        const href = new URL(match[1], baseUrl);
        href.hash = "";
        href.search = "";
        const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return { url: href, label };
      } catch {
        return null;
      }
    })
    .filter((item): item is { url: URL; label: string } => Boolean(item))
    .filter((item) => item.url.origin === base.origin)
    .filter((item) => auditLinkPattern.test(`${item.url.pathname} ${item.label}`))
    .map((item) => item.url.toString())
    .filter((link) => {
      if (seen.has(link)) return false;
      seen.add(link);
      return true;
    });

  return links.slice(0, limit);
}

function financialTitleFromUrl(link: string) {
  try {
    const url = new URL(link);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname).replace(/[-_]+/g, " ");
  } catch {
    return "Financial document";
  }
}

function sourceTypeFromUrl(link: string): ViabilitySourceType {
  if (/annual|impact/i.test(link)) return "annual_report";
  if (/990|form-990/i.test(link)) return "irs_990";
  return "website_audit";
}

function extractionMethodFromUrl(link: string): ExtractionMethod {
  if (/annual|impact/i.test(link)) return "annual report";
  if (/990|form-990/i.test(link)) return "990";
  if (/audit|audited|financial/i.test(link)) return "audit";
  return "website";
}

function metricExtractionMethod(sourceDocument: SourceDocument): ExtractionMethod {
  if (sourceDocument.extractionMethod === "manual upload") return "manual upload";
  if (sourceDocument.extractionMethod === "annual report") return "annual report";
  if (sourceDocument.extractionMethod === "990") return "990";
  if (sourceDocument.extractionMethod === "website") return "website";
  return "audit";
}

function excerptAround(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match?.index) return null;
  return text.slice(Math.max(0, match.index - 220), match.index + 420).replace(/\s+/g, " ").trim();
}
