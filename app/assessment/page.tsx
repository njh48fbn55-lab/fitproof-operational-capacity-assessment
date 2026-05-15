"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { CompetitorResearchResult, competitorResearchStorageKey } from "@/lib/competitor-research";
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
  const [isResearching, setIsResearching] = useState(false);
  const [researchError, setResearchError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setForm({ ...emptyAssessment, ...JSON.parse(saved) });
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
    setResearchError("");
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(competitorResearchStorageKey);
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
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 border-b border-line pb-5 md:flex-row md:items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded bg-ink text-sm font-semibold text-paper">FP</span>
            <span className="text-lg font-semibold text-ink">FitProof</span>
          </Link>
          <div className="flex gap-3">
            <button onClick={clearForm} className="rounded border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink">
              Reset
            </button>
            <Link href="/results" className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper">
              Saved report
            </Link>
          </div>
        </header>

        <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">Assessment form</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">Market Readiness inputs</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate">
              Capture the evidence investors and early buyers care about. FitProof will evaluate Market Readiness,
              Problem-Market Fit, and Market Fit Likelihood without claiming product-market fit.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              {fields.map((field) => (
                <div key={field.name} className="grid gap-2">
                  <label htmlFor={`field-${field.name}`} className="text-sm font-bold text-ink">
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
                      className="min-h-28 rounded border border-line bg-paper px-4 py-3 text-ink outline-none transition placeholder:text-slate/50 focus:border-moss focus:ring-4 focus:ring-moss/10"
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`field-${field.name}`}
                      name={field.name}
                      value={form[field.name]}
                      onChange={updateField}
                      className="rounded border border-line bg-paper px-4 py-3 text-ink outline-none transition focus:border-moss focus:ring-4 focus:ring-moss/10"
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
                      className="rounded border border-line bg-paper px-4 py-3 text-ink outline-none transition placeholder:text-slate/50 focus:border-moss focus:ring-4 focus:ring-moss/10"
                    />
                  )}
                  {field.name === "competitors" && (
                    <div className="mt-3 grid gap-4 border border-line bg-paper p-4">
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
                          className="rounded bg-ink px-4 py-3 text-sm font-bold text-paper transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isResearching ? "Researching..." : "Research competitors"}
                        </button>
                      </div>

                      {researchError && (
                        <p className="border border-copper/30 bg-cream px-3 py-2 text-sm text-copper">{researchError}</p>
                      )}

                      {researchResults.length > 0 && (
                        <div className="grid gap-3">
                          {researchResults.map((result) => (
                            <label
                              key={result.id}
                              className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 border border-line bg-cream/60 p-3"
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
                            className="rounded border border-moss bg-paper px-4 py-3 text-sm font-bold text-moss transition hover:bg-moss hover:text-paper"
                          >
                            Save selected competitors
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button className="rounded bg-moss px-5 py-4 text-sm font-bold text-paper shadow-soft transition hover:bg-ink">
                Generate results report
              </button>
            </form>
          </section>

          <aside className="h-fit border border-line bg-paper p-5 shadow-soft lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Live preview</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate">Market Readiness Score</p>
                <p className="mt-1 text-4xl font-bold text-ink">{preview.total}</p>
              </div>
              <div className="grid size-24 place-items-center rounded-full border-8 border-moss/20 text-lg font-bold text-moss">
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
                  <div className="h-2 rounded-full bg-cream">
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
