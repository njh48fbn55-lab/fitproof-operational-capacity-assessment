import { NonprofitSearchInput, Organization, SourceDocument } from "./types";
import { organizationFromProPublica, searchProPublica } from "./propublica-service";
import { fetchTextPage, makeId, normalizeEin, normalizeUrl, nowIso } from "./utils";

export async function nonprofitSearchService(input: NonprofitSearchInput): Promise<Organization> {
  const propublicaPayload = await searchProPublica(input).catch(() => null);
  const propublicaOrg = propublicaPayload ? organizationFromProPublica(propublicaPayload, input) : null;
  const website = normalizeUrl(input.website || propublicaOrg?.website || "");
  const websiteSource = website ? await websiteProfileSource(website) : null;

  if (propublicaOrg) {
    return {
      ...propublicaOrg,
      website: website || propublicaOrg.website,
      sources: [...propublicaOrg.sources, ...(websiteSource ? [websiteSource] : [])]
    };
  }

  return {
    id: makeId("org", input.ein || input.name || website || "unknown"),
    legalName: input.name || null,
    dbaNames: [],
    ein: normalizeEin(input.ein) || null,
    state: input.state || null,
    address: null,
    website: website || null,
    nteeCode: null,
    exemptionStatus: null,
    sourceConfidence: input.name || input.ein ? "low" : "low",
    sources: websiteSource ? [websiteSource] : []
  };
}

async function websiteProfileSource(website: string): Promise<SourceDocument | null> {
  const page = await fetchTextPage(website, 4000);
  if (!page) return null;

  return {
    id: makeId("source", `${website}-homepage`),
    title: page.title,
    url: website,
    sourceType: "website",
    confidence: "medium",
    extractionMethod: "website",
    retrievedAt: nowIso(),
    textExcerpt: page.text.slice(0, 1200),
    notes: "Homepage used to validate website and support organization profile enrichment."
  };
}
