import { FinancialYear, NonprofitSearchInput } from "./types";
import { financialYearsFromProPublica, searchProPublica } from "./propublica-service";
import { normalizeEin, writeJsonRecord } from "./utils";

export async function irs990Service(input: NonprofitSearchInput): Promise<FinancialYear[]> {
  const ein = normalizeEin(input.ein);
  if (!ein && !input.name) return [];

  const payload = await searchProPublica(input).catch(() => null);
  const years = payload ? financialYearsFromProPublica(payload) : [];

  if (ein && years.length) {
    await writeJsonRecord("irs-990", `${ein}.json`, {
      ein,
      retrievedAt: new Date().toISOString(),
      note: "Stored normalized annual filing records by EIN. ProPublica API v2 is used as the fast normalized 990 source; IRS TEOS bulk ingestion can replace or supplement this cache when configured.",
      years
    }).catch(() => undefined);
  }

  return years;
}
