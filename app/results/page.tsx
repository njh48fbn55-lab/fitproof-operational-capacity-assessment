"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssessmentInput, emptyAssessment, scoreAssessment, storageKey } from "@/lib/scoring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t border-line pt-6">
      <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
      <div className="report-prose mt-4 min-w-0">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="border-l-4 border-moss bg-cream/70 px-4 py-3 text-sm leading-6">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function ResultsPage() {
  const [assessment, setAssessment] = useState<AssessmentInput>(emptyAssessment);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      setAssessment({ ...emptyAssessment, ...JSON.parse(saved) });
      setHasSaved(true);
    }
  }, []);

  const report = useMemo(() => scoreAssessment(assessment), [assessment]);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-line pb-5 md:flex-row md:items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded bg-ink text-sm font-semibold text-paper">FP</span>
            <span className="text-lg font-semibold text-ink">FitProof</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/assessment" className="rounded border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink">
              Edit inputs
            </Link>
            <Link href="/" className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper">
              Home
            </Link>
          </div>
        </header>

        {!hasSaved && (
          <div className="mt-8 border border-copper/30 bg-paper p-4 text-sm text-slate">
            No saved assessment was found. The report below uses blank inputs as a preview; complete the assessment to generate a tailored report.
          </div>
        )}

        <article className="mt-8 min-w-0 bg-paper p-5 shadow-soft sm:p-8 lg:p-10">
          <div className="grid gap-8 border-b border-line pb-8 lg:grid-cols-[1fr_260px] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">FitProof results report</p>
              <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                {assessment.startupName || "Startup"} Market Readiness Report
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate">
                {report.executiveSummary}
              </p>
            </div>
            <div className="border border-line bg-cream p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-copper">Market Readiness Score</p>
              <p className="mt-4 text-7xl font-bold tracking-tight text-ink">{report.total}</p>
              <p className="mt-3 text-sm font-bold text-moss">{report.maturityLabel}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-8">
            <Section title="Score Breakdown Table">
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-slate">
                      <th className="py-3 pr-4">Dimension</th>
                      <th className="py-3 pr-4">Score</th>
                      <th className="py-3 pr-4">Weight</th>
                      <th className="py-3">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.breakdown.map((item) => (
                      <tr key={item.dimension} className="border-b border-line/80">
                        <td className="py-4 pr-4 font-semibold text-ink">{item.dimension}</td>
                        <td className="py-4 pr-4 tabular-nums text-ink">{item.points}</td>
                        <td className="py-4 pr-4 tabular-nums text-slate">{item.maxPoints}</td>
                        <td className="py-4 leading-6 text-slate">{item.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Executive Summary">
              <p className="text-base leading-7">{report.executiveSummary}</p>
            </Section>

            <Section title="ICP Hypotheses">
              <List items={report.icpHypotheses} />
            </Section>

            <Section title="Pain Proxy Analysis">
              <List items={report.painProxyAnalysis} />
            </Section>

            <Section title="Competitive Alternatives">
              <List items={report.competitiveAlternatives} />
            </Section>

            <Section title="Messaging Recommendations">
              <List items={report.messagingRecommendations} />
            </Section>

            <Section title="Validation Gaps">
              <List items={report.validationGaps.length ? report.validationGaps : ["No major scoring gaps detected. Continue proving usage, revenue, and retention before making product-market fit claims."]} />
            </Section>

            <Section title="Discovery Questions">
              <List items={report.discoveryQuestions} />
            </Section>

            <Section title="Recommended Experiments">
              <List items={report.recommendedExperiments} />
            </Section>
          </div>
        </article>
      </div>
    </main>
  );
}
