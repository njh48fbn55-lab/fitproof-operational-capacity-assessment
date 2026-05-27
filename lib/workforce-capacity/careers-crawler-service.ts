import { SourceDocument } from "@/lib/nonprofit-viability/types";
import { fetchTextPage, makeId, normalizeUrl, nowIso, textFromHtml } from "@/lib/nonprofit-viability/utils";
import { CareersCrawlResult, CareersPlatform, CareersRole, LeadershipLevel } from "./types";

const careerLinkPattern = /(career|careers|jobs|join|employment|work-with-us|work_with_us|open-position|opportunit|greenhouse|lever|workday|bamboohr|jazzhr|paylocity|adp|icims)/i;
const maxCareerPages = 14;

export async function careersCrawlerService({
  organizationName,
  websiteUrl
}: {
  organizationName?: string | null;
  websiteUrl?: string | null;
}): Promise<CareersCrawlResult> {
  const rootUrl = normalizeUrl(websiteUrl || "");
  if (!rootUrl) {
    return { roles: [], sources: [], searchedUrls: [], notes: ["No website URL was provided, so careers pages could not be searched."] };
  }

  const notes: string[] = [];
  const seeds = await buildCareerSeeds(rootUrl);
  const roles: CareersRole[] = [];
  const sources: SourceDocument[] = [];
  const searchedUrls: string[] = [];

  for (const seed of seeds.slice(0, maxCareerPages)) {
    searchedUrls.push(seed);
    const platform = platformForUrl(seed);

    const providerRoles = await fetchProviderRoles(seed, platform);
    if (providerRoles.length) {
      roles.push(...providerRoles);
      sources.push(sourceFor(seed, `${platformLabel(platform)} job board`, "high"));
      continue;
    }

    const page = await fetchTextPage(seed, 4500);
    if (!page) continue;

    sources.push(sourceFor(page.url, page.title, "medium", page.text.slice(0, 1200)));
    roles.push(...extractJsonLdRoles(page.html, page.url, platform));
    roles.push(...extractLinkedRoles(page.html, page.url, platform, organizationName || undefined));
  }

  const dedupedRoles = dedupeRoles(roles);
  if (!dedupedRoles.length) notes.push("No public open roles were found on reviewed careers pages or common hiring platforms.");

  return {
    roles: dedupedRoles,
    sources: dedupeSources(sources),
    searchedUrls: [...new Set(searchedUrls)],
    notes
  };
}

async function buildCareerSeeds(rootUrl: string) {
  const seeds = new Set<string>();
  const root = new URL(rootUrl);
  const commonPaths = [
    "/careers",
    "/career",
    "/jobs",
    "/join-our-team",
    "/employment",
    "/work-with-us",
    "/about/careers",
    "/about-us/careers",
    "/about/jobs",
    "/who-we-are/careers"
  ];

  commonPaths.forEach((path) => seeds.add(new URL(path, root).toString()));

  const home = await fetchTextPage(rootUrl, 4000);
  if (!home?.html) return [...seeds];

  for (const link of extractCareerLinks(home.html, rootUrl, 18)) {
    seeds.add(link);
  }

  return [...seeds];
}

async function fetchProviderRoles(url: string, platform: CareersPlatform) {
  if (platform === "greenhouse") return fetchGreenhouseRoles(url);
  if (platform === "lever") return fetchLeverRoles(url);
  return [];
}

async function fetchGreenhouseRoles(url: string): Promise<CareersRole[]> {
  const board = providerPathSegment(url);
  if (!board) return [];
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>(apiUrl);
  return (data?.jobs || []).map((job) => {
    const title = stringValue(job.title) || "Untitled role";
    const departments = Array.isArray(job.departments) ? job.departments.map((item) => stringValue((item as Record<string, unknown>).name)).filter(Boolean) : [];
    const offices = Array.isArray(job.offices) ? job.offices.map((item) => stringValue((item as Record<string, unknown>).name)).filter(Boolean) : [];
    const absoluteUrl = stringValue(job.absolute_url) || url;

    return role({
      title,
      department: departments[0] || inferDepartment(title),
      location: offices[0] || null,
      updatedDate: stringValue(job.updated_at),
      requisitionUrl: absoluteUrl,
      platform: "greenhouse",
      confidence: "high"
    });
  });
}

async function fetchLeverRoles(url: string): Promise<CareersRole[]> {
  const company = providerPathSegment(url);
  if (!company) return [];
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
  const data = await fetchJson<Array<Record<string, unknown>>>(apiUrl);
  return (data || []).map((posting) => {
    const categories = (posting.categories || {}) as Record<string, unknown>;
    const title = stringValue(posting.text) || "Untitled role";

    return role({
      title,
      department: stringValue(categories.department) || inferDepartment(title),
      location: stringValue(categories.location),
      employmentType: stringValue(categories.commitment),
      updatedDate: numberDate(posting.createdAt),
      requisitionUrl: stringValue(posting.hostedUrl) || url,
      platform: "lever",
      confidence: "high"
    });
  });
}

function extractJsonLdRoles(html: string, baseUrl: string, platform: CareersPlatform) {
  const roles: CareersRole[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const json = safeJson(match[1]);
    const items = Array.isArray(json) ? json : [json];
    for (const item of flattenJsonLd(items)) {
      if (!item || String(item["@type"] || "").toLowerCase() !== "jobposting") continue;
      const title = stringValue(item.title);
      if (!title) continue;
      roles.push(role({
        title,
        department: stringValue(item.industry) || stringValue(item.occupationalCategory) || inferDepartment(title),
        location: locationFromJsonLd(item.jobLocation),
        postedDate: stringValue(item.datePosted),
        updatedDate: stringValue(item.validThrough),
        employmentType: stringValue(item.employmentType),
        requisitionUrl: absoluteUrl(stringValue(item.url), baseUrl) || baseUrl,
        platform,
        confidence: "high"
      }));
    }
  }
  return roles;
}

function extractLinkedRoles(html: string, baseUrl: string, platform: CareersPlatform, organizationName?: string) {
  const roles: CareersRole[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1] || "";
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
    const text = cleanTitle(textFromHtml(match[2] || ""));
    const url = absoluteUrl(href, baseUrl);
    if (!url || !isLikelyJobLink(url, text, organizationName)) continue;
    roles.push(role({
      title: text || titleFromJobUrl(url),
      department: inferDepartment(text || url),
      location: inferLocationFromText(`${text} ${attrs}`),
      requisitionUrl: url,
      platform: platformForUrl(url) === "unknown" ? platform : platformForUrl(url),
      confidence: text ? "medium" : "low"
    }));
  }
  return roles.filter((item) => item.title.length >= 3);
}

function extractCareerLinks(html: string, baseUrl: string, limit: number) {
  const base = new URL(baseUrl);
  const rootParts = base.hostname.split(".").slice(-2).join(".");
  const seen = new Set<string>();
  const links: string[] = [];

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      url.hash = "";
      const hostnameRoot = url.hostname.split(".").slice(-2).join(".");
      const sameOrg = hostnameRoot === rootParts;
      const provider = platformForUrl(url.toString()) !== "unknown";
      const normalized = url.toString();
      if (!seen.has(normalized) && (sameOrg || provider) && careerLinkPattern.test(normalized)) {
        seen.add(normalized);
        links.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return links.slice(0, limit);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FitProof Workforce Capacity Analyzer/1.0" },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function role(input: Pick<CareersRole, "title" | "requisitionUrl" | "platform" | "confidence"> & Partial<Pick<CareersRole, "department" | "location" | "postedDate" | "updatedDate" | "employmentType">>): CareersRole {
  return {
    id: makeId("role", `${input.title}-${input.requisitionUrl}`),
    title: cleanTitle(input.title),
    department: input.department || inferDepartment(input.title),
    location: input.location || null,
    postedDate: input.postedDate || null,
    updatedDate: input.updatedDate || null,
    employmentType: input.employmentType || null,
    leadershipLevel: inferLeadershipLevel(input.title),
    requisitionUrl: input.requisitionUrl,
    platform: input.platform,
    sourceName: platformLabel(input.platform),
    confidence: input.confidence
  };
}

function sourceFor(url: string, title: string, confidence: SourceDocument["confidence"], textExcerpt?: string): SourceDocument {
  return {
    id: makeId("source", url),
    title,
    url,
    sourceType: "website",
    confidence,
    extractionMethod: "website",
    retrievedAt: nowIso(),
    notes: "Reviewed for public hiring and staffing capacity signals.",
    textExcerpt
  };
}

function dedupeRoles(roles: CareersRole[]) {
  const seen = new Set<string>();
  return roles.filter((roleItem) => {
    const key = `${roleItem.title.toLowerCase()}|${roleItem.requisitionUrl.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeSources(sources: SourceDocument[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url || source.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function platformForUrl(url: string): CareersPlatform {
  const lower = url.toLowerCase();
  if (/greenhouse\.io/.test(lower)) return "greenhouse";
  if (/jobs\.lever\.co/.test(lower)) return "lever";
  if (/myworkdayjobs\.com|workdayjobs\.com/.test(lower)) return "workday";
  if (/bamboohr\.com/.test(lower)) return "bamboohr";
  if (/jazzhr\.com|applytojob\.com/.test(lower)) return "jazzhr";
  if (/paylocity\.com/.test(lower)) return "paylocity";
  if (/adp\.com/.test(lower)) return "adp";
  if (/icims\.com/.test(lower)) return "icims";
  return "unknown";
}

function platformLabel(platform: CareersPlatform) {
  return platform === "organization" || platform === "unknown" ? "Organization careers page" : `${platform[0].toUpperCase()}${platform.slice(1)} careers`;
}

function providerPathSegment(url: string) {
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0];
    return segment || "";
  } catch {
    return "";
  }
}

function isLikelyJobLink(url: string, title: string, organizationName?: string) {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (platformForUrl(url) !== "unknown") return true;
  if (/\/(job|jobs|career|careers|position|posting|requisition|opening)s?\b/.test(lowerUrl)) return true;
  if (/\b(apply|open role|job|position|career|hiring|employment)\b/.test(lowerTitle)) return true;
  if (organizationName && lowerTitle.includes(organizationName.toLowerCase()) && /career|job/.test(lowerUrl)) return true;
  return false;
}

function inferLeadershipLevel(title: string): LeadershipLevel {
  if (/\b(chief|ceo|cfo|coo|cio|cto|president|executive director|vp|vice president)\b/i.test(title)) return "executive";
  if (/\b(senior director|director|head of|principal|controller)\b/i.test(title)) return "senior_leader";
  if (/\b(manager|supervisor|lead)\b/i.test(title)) return "manager";
  return title ? "individual_contributor" : "unknown";
}

function inferDepartment(value: string) {
  const text = value.toLowerCase();
  if (/finance|accounting|controller|payroll|billing/.test(text)) return "Finance";
  if (/development|fundraising|grant|donor|advancement/.test(text)) return "Development";
  if (/human resources|people|talent|recruit/.test(text)) return "Human Resources";
  if (/program|service|case|client|mission|clinical|residential|employment/.test(text)) return "Programs";
  if (/operations|facilities|administration|admin/.test(text)) return "Operations";
  if (/technology|data|systems|it|information/.test(text)) return "Technology";
  if (/marketing|communication|community/.test(text)) return "Marketing and Communications";
  return null;
}

function inferLocationFromText(text: string) {
  return text.match(/\b(remote|hybrid|onsite|on-site)\b/i)?.[1] || null;
}

function cleanTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\b(apply now|view job|learn more|open role|job details)\b/gi, "")
    .trim()
    .slice(0, 160);
}

function titleFromJobUrl(url: string) {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() || "Open role";
    return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 140);
  } catch {
    return "Open role";
  }
}

function absoluteUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function flattenJsonLd(items: unknown[]): Record<string, unknown>[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) return flattenJsonLd(record["@graph"]);
    return [record];
  });
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function numberDate(value: unknown) {
  if (typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function locationFromJsonLd(value: unknown) {
  if (!value) return null;
  const locations = Array.isArray(value) ? value : [value];
  const first = locations[0];
  if (!first || typeof first !== "object") return null;
  const address = (first as Record<string, unknown>).address;
  if (!address || typeof address !== "object") return null;
  const record = address as Record<string, unknown>;
  return [record.addressLocality, record.addressRegion, record.addressCountry].map(stringValue).filter(Boolean).join(", ") || null;
}
