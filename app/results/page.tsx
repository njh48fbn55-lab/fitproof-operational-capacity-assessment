"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssessmentInput, emptyAssessment, scoreAssessment, storageKey } from "@/lib/scoring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded border border-line bg-paper p-5">
      <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
      <div className="report-prose mt-4 min-w-0">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="rounded border border-line bg-cream px-4 py-3 text-sm leading-6">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ScoreTable({ items }: { items: Array<{ dimension: string; points: number; maxPoints: number; rationale: string }> }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-cream text-xs uppercase tracking-[0.12em] text-slate">
            <th className="py-3 pr-4">Dimension</th>
            <th className="py-3 pr-4">Score</th>
            <th className="py-3 pr-4">Weight</th>
            <th className="py-3">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.dimension} className="border-b border-line/80 last:border-b-0">
              <td className="py-4 pr-4 font-semibold text-ink">{item.dimension}</td>
              <td className="py-4 pr-4 tabular-nums text-ink">{item.points}</td>
              <td className="py-4 pr-4 tabular-nums text-slate">{item.maxPoints}</td>
              <td className="py-4 leading-6 text-slate">{item.rationale}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <main className="min-h-screen bg-cream px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-4 rounded border border-line bg-paper px-4 py-3 shadow-soft md:flex-row md:items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded bg-moss text-xs font-bold text-paper">FP</span>
            <span>
              <span className="block text-sm font-bold text-ink">FitProof</span>
              <span className="block text-xs text-slate">Results dashboard</span>
            </span>
          </Link>
          <div className="flex gap-3">
            <Link href="/assessment" className="rounded border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss">
              Edit inputs
            </Link>
            <Link href="/" className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-moss">
              Home
            </Link>
          </div>
        </header>

        {!hasSaved && (
          <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No saved assessment was found. The report below uses blank inputs as a preview; complete the assessment to generate a tailored report.
          </div>
        )}

        <article className="mt-6 min-w-0">
          <div className="grid gap-6 rounded border border-line bg-paper p-5 shadow-soft sm:p-6 lg:grid-cols-[1fr_260px] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">FitProof results report</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
                {assessment.startupName || "Startup"} Market Readiness Report
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate">
                {report.executiveSummary}
              </p>
            </div>
            <div className="rounded border border-blue-100 bg-blue-50 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-moss">Total Market Readiness Score</p>
              <p className="mt-3 text-6xl font-bold tracking-tight text-ink">{report.total}</p>
              <p className="mt-3 text-sm font-bold text-copper">{report.maturityLabel}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Maturity Label", report.maturityLabel],
              ["Positive Score Subtotal", `${report.positiveScore}/100`],
              ["Penalty Subtotal", `${report.penaltyScore}/-40`]
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-line bg-paper p-4 shadow-soft">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate">{label}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4">
            <Section title="Score Breakdown Table">
              <p className="mb-4 text-sm leading-6 text-slate">
                Positive dimensions measure venture attractiveness. Penalty dimensions are risk adjustments, not failures; they keep crowded, mature, low-differentiation categories from scoring too generously.
              </p>
              <div className="grid gap-6">
                <div>
                  <h3 className="mb-3 text-sm font-bold text-ink">Positive dimensions</h3>
                  <ScoreTable items={report.positiveBreakdown} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-bold text-ink">Penalty risk adjustments</h3>
                  <ScoreTable items={report.penaltyBreakdown} />
                </div>
              </div>
            </Section>

            <Section title="Executive Summary">
              <p className="text-base leading-7">{report.executiveSummary}</p>
            </Section>

            <Section title="Investor-Readiness Conclusion">
              <p className="text-base leading-7">{report.investorReadinessConclusion}</p>
            </Section>

            <Section title="Top 3 Strengths">
              <List items={report.topStrengths} />
            </Section>

            <Section title="Top 3 Risks">
              <List items={report.topRisks} />
            </Section>

            <Section title="Recommended Actions To Improve Score">
              <List items={report.recommendedActions} />
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
