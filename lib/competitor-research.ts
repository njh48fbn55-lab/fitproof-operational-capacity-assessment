export type CompetitorResearchResult = {
  id: string;
  name: string;
  domain: string;
  url: string;
  summary: string;
  fitReason: string;
};

export const competitorResearchStorageKey = "fitproof.competitorResearch.v1";
