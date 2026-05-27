import { NonprofitSearchInput, PublicRecordSignal } from "./types";
import { formatEin, normalizeEin } from "./utils";

export async function publicRecordsService(input: NonprofitSearchInput, include = true): Promise<PublicRecordSignal[]> {
  if (!include) return [];
  const name = input.name || "nonprofit";
  const ein = normalizeEin(input.ein);

  return [
    {
      title: "IRS Tax Exempt Organization Search",
      url: "https://apps.irs.gov/app/eos/",
      signalType: "exemption",
      relevance: ein ? `Use TEOS to verify exemption status, determination letters, and filings for EIN ${formatEin(ein)}.` : `Use TEOS to verify exemption status and filings for ${name}.`,
      confidence: "medium"
    },
    {
      title: "Secretary of State record search",
      signalType: "secretary_of_state",
      relevance: input.state ? `Search ${input.state} Secretary of State records for corporate standing, registered agent, and entity status.` : "State was not provided, so Secretary of State search must be targeted manually.",
      confidence: input.state ? "medium" : "low"
    },
    {
      title: "Relevant news and enforcement search",
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${name}" nonprofit funding leadership litigation enforcement`)}`,
      signalType: "news",
      relevance: "Include only news or legal records that affect viability, governance, funding, leadership, or operational continuity.",
      confidence: "low"
    }
  ];
}
