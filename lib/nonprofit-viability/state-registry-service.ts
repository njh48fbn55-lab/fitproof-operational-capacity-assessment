import { RegistrySearchResult, SourceDocument } from "./types";
import { makeId, nowIso } from "./utils";

const registrySearches: Record<string, { label: string; url: (name: string) => string; notes: (name: string) => string }> = {
  NY: {
    label: "NY Charities Bureau / CHAR500",
    url: (name) => `https://www.charitiesnys.com/RegistrySearch/search_charities.jsp?orgName=${encodeURIComponent(name)}`,
    notes: () => "Use NY Charities Bureau records to locate CHAR500 filings, audited financial statements, registration status, and filing compliance."
  },
  CA: {
    label: "California Registry of Charitable Trusts",
    url: (name) => `https://rct.doj.ca.gov/Verification/Web/Search.aspx?facility=Y&search=${encodeURIComponent(name)}`,
    notes: () => "Use California Registry records for charitable trust status, filings, correspondence, and registration standing."
  },
  MA: {
    label: "Massachusetts AGO Public Charities",
    url: (name) => `https://www.mass.gov/orgs/the-attorney-generals-non-profit-organizations-public-charities-division`,
    notes: (name) => `Search Massachusetts AGO public charities filings for ${name}; public search URLs vary by session, so this connector returns the official search entry point.`
  },
  FL: {
    label: "Florida Solicitation of Contributions Registry",
    url: (name) => `https://csapp.fdacs.gov/CSPublicApp/CheckACharity/CheckACharity.aspx?search=${encodeURIComponent(name)}`,
    notes: () => "Use Florida solicitation records for registration status, contribution data, and compliance signals."
  }
};

export async function stateRegistryService(name?: string, state?: string | null, include = true): Promise<RegistrySearchResult[]> {
  if (!include || !name) return [];
  const normalizedState = (state || "").toUpperCase();
  const selected = normalizedState && registrySearches[normalizedState] ? [normalizedState] : Object.keys(registrySearches);

  return selected.map((stateCode) => {
    const registry = registrySearches[stateCode];
    const searchUrl = registry.url(name);
    const notes = registry.notes(name);
    const source: SourceDocument = {
      id: makeId("source", `${stateCode}-${name}`),
      title: registry.label,
      url: searchUrl,
      sourceType: "state_registry",
      confidence: normalizedState === stateCode ? "medium" : "low",
      extractionMethod: "state filing",
      retrievedAt: nowIso(),
      notes
    };

    return {
      state: stateCode,
      status: null,
      searchUrl,
      notes,
      sources: [source]
    };
  });
}
