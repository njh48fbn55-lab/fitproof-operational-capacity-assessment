import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function normalizeEin(ein?: string | null) {
  const digits = (ein || "").replace(/\D/g, "");
  return digits.length === 9 ? digits : "";
}

export function formatEin(ein?: string | null) {
  const normalized = normalizeEin(ein);
  return normalized ? `${normalized.slice(0, 2)}-${normalized.slice(2)}` : "";
}

export function slugify(value: string) {
  return (value || "organization")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "organization";
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string, value: string) {
  return `${prefix}_${slugify(value)}_${Date.now().toString(36)}`;
}

export function normalizeUrl(input?: string | null) {
  if (!input?.trim()) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(withProtocol).toString();
  } catch {
    return "";
  }
}

export function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function titleFromHtml(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return textFromHtml(title || "") || fallback;
}

export async function fetchTextPage(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FitProof Nonprofit Viability Analyzer/1.0" },
      signal: controller.signal
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    return {
      url,
      contentType,
      html: body,
      text: contentType.includes("html") ? textFromHtml(body) : body,
      title: contentType.includes("html") ? titleFromHtml(body, new URL(url).hostname) : path.basename(new URL(url).pathname) || url
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractLinks(html: string, baseUrl: string, pattern: RegExp, limit = 12) {
  const base = new URL(baseUrl);
  const seen = new Set<string>();

  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        const url = new URL(match[1], baseUrl);
        url.hash = "";
        return url;
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => url.origin === base.origin)
    .map((url) => {
      url.search = "";
      return url.toString();
    })
    .filter((url) => {
      if (!pattern.test(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, limit);
}

export function moneyFromText(text: string, labelPattern: RegExp) {
  const match = text.match(labelPattern);
  if (!match?.[1]) return null;
  const value = match[1].replace(/[$,\s]/g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function localDataDir() {
  return process.env.VIABILITY_DATA_DIR || path.join(process.cwd(), "viability-data");
}

export async function writeJsonRecord(folder: string, filename: string, data: unknown) {
  const dir = path.join(localDataDir(), folder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}

export async function readJsonRecord<T>(folder: string, filename: string) {
  const filePath = path.join(localDataDir(), folder, filename);
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text) as T;
}

export function metricLabel(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

export function fiscalYearFromText(text: string) {
  const match =
    text.match(/(?:year ended|fiscal year|tax year|for the year ended)[^\d]*(20\d{2})/i) ||
    text.match(/\b(20\d{2})\b/);
  const year = Number(match?.[1]);
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

export function roughTextFromBytes(bytes: Buffer) {
  return bytes
    .toString("latin1")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);

  const [headers = [], ...records] = rows;
  const normalizedHeaders = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));

  return records.map((record) =>
    Object.fromEntries(record.map((value, index) => [normalizedHeaders[index] || `column${index}`, value.trim()]))
  );
}
