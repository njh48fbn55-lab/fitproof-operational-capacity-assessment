"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { CompetitorResearchResult, competitorResearchStorageKey } from "@/lib/competitor-research";
import { IcpSuggestion, icpSuggestionStorageKey } from "@/lib/icp-suggestions";
import { AssessmentInput, emptyAssessment, scoreAssessment, storageKey } from "@/lib/scoring";

const fields: Array<{
  name: keyof AssessmentInput;
  label: string;
  type?: "textarea" | "select";
  placeholder?: string;
}> = [
  { name: "startupName", label: "Startup name", placeholder: "FitProof" },
  { name: "productDescription", label: "Product description", type: "textarea", placeholder: "A concise explanation of what the product does and the outcome it creates." },
  { name: "targetCustomer", label: "Target customer", placeholder: "Seed-stage B2B founders selling to revenue leaders" },
  { name: "problemSolved", label: "Problem solved", type: "textarea", placeholder: "What painful, urgent problem is being solved?" },
  { name: "currentAlternatives", label: "Current alternatives", type: "textarea", placeholder: "Spreadsheets, agencies, internal analysts, incumbent tools, doing nothing" },
  { name: "economicBuyer", label: "Economic buyer", placeholder: "VP Sales, CFO, founder, head of operations" },
  { name: "proposedPricing", label: "Proposed pricing", placeholder: "$299/month, annual contract, usage-based, paid pilot" },
  { name: "marketCategory", label: "Market category", placeholder: "Sales intelligence, compliance ops, AI customer support" },
  { name: "whyNow", label: "Why now", type: "textarea", placeholder: "What external shift makes buyers more likely to act now?" },
  { name: "existingEvidence", label: "Existing evidence", type: "textarea", placeholder: "Interview counts, LOIs, waitlist, paid pilots, usage, revenue, retention, investor/customer pull" },
  { name: "competitors", label: "Competitors", type: "textarea", placeholder: "Direct tools, indirect substitutes, services firms, internal build" },
  { name: "geography", label: "Geography", placeholder: "US mid-market, EU fintech, global English-speaking SMBs" },
  { name: "stage", label: "Stage", type: "select" }
];

const stages: AssessmentInput["stage"][] = ["Idea", "Prototype", "Private beta", "Public beta", "Pre-seed", "Seed"];

export default function AssessmentPage() {
  const router = useRouter();
  const [form, setForm] = useState<AssessmentInput>(emptyAssessment);
  const [researchResults, setResearchResults] = useState<CompetitorResearchResult[]>([]);
  const [selectedResearchIds, setSelectedResearchIds] = useState<string[]>([]);
  const [icpSuggestions, setIcpSuggestions] = useState<IcpSuggestion[]>([]);
  const [isResearching, setIsResearching] = useState(false);
  const [isSuggestingIcps, setIsSuggestingIcps] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [icpError, setIcpError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setForm({ ...emptyAssessment, ...JSON.parse(saved) });
    const savedIcps = window.localStorage.getItem(icpSuggestionStorageKey);
    if (savedIcps) setIcpSuggestions(JSON.parse(savedIcps) as IcpSuggestion[]);
    const savedResearch = window.localStorage.getItem(competitorResearchStorageKey);
    if (savedResearch) {
      const parsed = JSON.parse(savedResearch) as CompetitorResearchResult[];
      setResearchResults(parsed);
      setSelectedResearchIds(parsed.map((result) => result.id));
    }
  }, []);

  const completion = useMemo(() => {
    const filled = Object.values(form).filter((value) => String(value).trim().length > 0).length;
    return Math.round((filled / Object.keys(form).length) * 100);
  }, [form]);

  const preview = useMemo(() => scoreAssessment(form), [form]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify(form));
    router.push("/results");
  }

  function clearForm() {
    setForm(emptyAssessment);
    setResearchResults([]);
    setSelectedResearchIds([]);
    setIcpSuggestions([]);
    setResearchError("");
    setIcpError("");
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(competitorResearchStorageKey);
    window.localStorage.removeItem(icpSuggestionStorageKey);
  }

  async function suggestIcps() {
    setIsSuggestingIcps(true);
    setIcpError("");

    try {
      const response = await fetch("/api/suggest-icps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as { suggestions?: IcpSuggestion[]; error?: string };
      if (!response.ok) throw new Error(data.error || "ICP suggestion failed.");

      const suggestions = data.suggestions || [];
      setIcpSuggestions(suggestions);
      window.localStorage.setItem(icpSuggestionStorageKey, JSON.stringify(suggestions));
      if (!suggestions.length) {
        setIcpError("No ICP suggestions were generated. Add a clearer product description, problem, or market category.");
      }
    } catch (error) {
      setIcpError(error instanceof Error ? error.message : "ICP suggestion failed.");
    } finally {
      setIsSuggestingIcps(false);
    }
  }

  function applyIcpSuggestion(suggestion: IcpSuggestion) {
    const nextForm = {
      ...form,
      targetCustomer: `${suggestion.segment}: ${suggestion.description}`,
      economicBuyer: form.economicBuyer.trim() ? form.economicBuyer : suggestion.economicBuyer
    };

    setForm(nextForm);
    window.localStorage.setItem(storageKey, JSON.stringify(nextForm));
  }

  async function researchCompetitors() {
    setIsResearching(true);
    setResearchError("");

    try {
      const response = await fetch("/api/research-competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productDescription: form.productDescription,
          problemSolved: form.problemSolved,
          targetCustomer: form.targetCustomer,
          marketCategory: form.marketCategory,
          currentAlternatives: form.currentAlternatives
        })
      });

      const data = (await response.json()) as { results?: CompetitorResearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Competitor research failed.");

      const results = data.results || [];
      setResearchResults(results);
      setSelectedResearchIds(results.slice(0, 4).map((result) => result.id));
      if (!results.length) {
        setResearchError("No likely competitors were found. Try adding a more specific market category or current alternative.");
      }
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : "Competitor research failed.");
    } finally {
      setIsResearching(false);
    }
  }

  function toggleResearchResult(id: string) {
    setSelectedResearchIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function saveSelectedCompetitors() {
    const selected = researchResults.filter((result) => selectedResearchIds.includes(result.id));
    const competitorLines = selected.map(
      (result) => `${result.name} (${result.domain}) - ${result.summary}`
    );
    const nextForm = {
      ...form,
      competitors: competitorLines.join("\n")
    };

    setForm(nextForm);
    window.localStorage.setItem(storageKey, JSON.stringify(nextForm));
    window.localStorage.setItem(competitorResearchStorageKey, JSON.stringify(selected));
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 rounded border border-line bg-paper px-4 py-3 shadow-soft md:flex-row md:items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded bg-moss text-xs font-bold text-paper">FP</span>
            <span>
              <span className="block text-sm font-bold text-ink">FitProof</span>
              <span className="block text-xs text-slate">Assessment workspace</span>
            </span>
          </Link>
          <div className="flex gap-3">
            <button onClick={clearForm} className="rounded border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss">
              Reset
            </button>
            <Link href="/results" className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-moss">
              Saved report
            </Link>
          </div>
        </header>

        <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded border border-line bg-paper p-5 shadow-soft sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">Assessment form</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Market Readiness inputs</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate">
              Capture the evidence investors and early buyers care about. FitProof will evaluate Market Readiness,
              Problem-Market Fit, and Market Fit Likelihood without claiming product-market fit.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
              {fields.map((field) => (
                <div key={field.name} className="grid gap-2">
                  <label htmlFor={`field-${field.name}`} className="text-sm font-semibold text-ink">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={`field-${field.name}`}
                      name={field.name}
                      value={form[field.name]}
                      onChange={updateField}
                      rows={4}
                      placeholder={field.placeholder}
                      className="min-h-28 rounded border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate/50 focus:border-moss focus:ring-4 focus:ring-moss/10"
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`field-${field.name}`}
                      name={field.name}
                      value={form[field.name]}
                      onChange={updateField}
                      className="rounded border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-4 focus:ring-moss/10"
                    >
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`field-${field.name}`}
                      name={field.name}
                      value={form[field.name]}
                      onChange={updateField}
                      placeholder={field.placeholder}
                      className="rounded border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate/50 focus:border-moss focus:ring-4 focus:ring-moss/10"
                    />
                  )}
                  {field.name === "targetCustomer" && (
                    <div className="mt-3 grid gap-4 rounded border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-sm font-bold text-ink">ICP suggestion engine</p>
                          <p className="mt-1 text-sm leading-6 text-slate">
                            Generate likely initial customer profiles from the product, problem, market category, buyer, geography, and stage.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={suggestIcps}
                          disabled={isSuggestingIcps}
                          className="rounded bg-moss px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSuggestingIcps ? "Suggesting..." : "Suggest ICPs"}
                        </button>
                      </div>

                      {icpError && (
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{icpError}</p>
                      )}

                      {icpSuggestions.length > 0 && (
                        <div className="grid gap-3">
                          {icpSuggestions.map((suggestion) => (
                            <div key={suggestion.id} className="rounded border border-line bg-paper p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-bold text-ink">{suggestion.segment}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate">{suggestion.description}</p>
                                </div>
                                <span className="w-fit rounded bg-cream px-2.5 py-1 text-xs font-bold text-copper">
                                  {suggestion.confidence}
                                </span>
                              </div>
                              <dl className="mt-3 grid gap-2 text-sm leading-6 text-slate">
                                <div>
                                  <dt className="font-semibold text-ink">Economic buyer</dt>
                                  <dd>{suggestion.economicBuyer}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold text-ink">Buying trigger</dt>
                                  <dd>{suggestion.buyingTrigger}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold text-ink">Validation question</dt>
                                  <dd>{suggestion.validationQuestion}</dd>
                                </div>
                              </dl>
                              <button
                                type="button"
                                onClick={() => applyIcpSuggestion(suggestion)}
                                className="mt-4 rounded border border-moss bg-paper px-4 py-2.5 text-sm font-bold text-moss transition hover:bg-moss hover:text-paper"
                              >
                                Use this ICP
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {field.name === "competitors" && (
                    <div className="mt-3 grid gap-4 rounded border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-sm font-bold text-ink">Web-assisted competitor discovery</p>
                          <p className="mt-1 text-sm leading-6 text-slate">
                            Search from the product, problem, customer, category, and alternatives, then choose which results belong in the report.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={researchCompetitors}
                          disabled={isResearching}
                          className="rounded bg-moss px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isResearching ? "Researching..." : "Research competitors"}
                        </button>
                      </div>

                      {researchError && (
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{researchError}</p>
                      )}

                      {researchResults.length > 0 && (
                        <div className="grid gap-3">
                          {researchResults.map((result) => (
                            <label
                              key={result.id}
                              className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded border border-line bg-paper p-3 transition hover:border-moss"
                            >
                              <input
                                type="checkbox"
                                checked={selectedResearchIds.includes(result.id)}
                                onChange={() => toggleResearchResult(result.id)}
                                className="mt-1 size-4 accent-moss"
                              />
                              <span>
                                <span className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                  <span className="font-bold text-ink">{result.name}</span>
                                  <span className="text-xs text-slate">{result.domain}</span>
                                </span>
                                <span className="mt-2 block text-sm leading-6 text-slate">{result.summary}</span>
                                <span className="mt-2 block text-xs leading-5 text-slate">{result.fitReason}</span>
                              </span>
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={saveSelectedCompetitors}
                            className="rounded border border-moss bg-paper px-4 py-2.5 text-sm font-bold text-moss transition hover:bg-moss hover:text-paper"
                          >
                            Save selected competitors
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button className="rounded bg-moss px-5 py-3 text-sm font-bold text-paper shadow-soft transition hover:bg-blue-700">
                Generate results report
              </button>
            </form>
          </section>

          <aside className="h-fit rounded border border-line bg-paper p-5 shadow-soft lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">Live preview</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate">Market Readiness Score</p>
                <p className="mt-1 text-4xl font-bold text-ink">{preview.total}</p>
              </div>
              <div className="grid size-20 place-items-center rounded border border-blue-100 bg-blue-50 text-lg font-bold text-moss">
                {completion}%
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold text-ink">{preview.maturityLabel}</p>
            <div className="mt-5 grid gap-3">
              {preview.breakdown.map((item) => (
                <div key={item.dimension}>
                  <div className="mb-1 flex justify-between gap-3 text-xs font-semibold text-slate">
                    <span>{item.dimension}</span>
                    <span>
                      {item.points}/{item.maxPoints}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-moss"
                      style={{ width: `${(item.points / item.maxPoints) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
