"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  allQuestions,
  dimensions,
  emptyProfile,
  emptyResponses,
  formatCurrency,
  ProfileInput,
  ratingLabels,
  revenueStreams,
  scoreAssessment
} from "@/lib/nonprofit-revenue-assessment";

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  name: keyof ProfileInput;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-h-11 rounded border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate/50 focus:border-moss focus:ring-4 focus:ring-moss/10"
      />
    </label>
  );
}

function Meter({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" }) {
  const color = tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-moss";

  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<ProfileInput>(emptyProfile);
  const [responses, setResponses] = useState<Record<string, number>>(emptyResponses);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => scoreAssessment(profile, responses), [profile, responses]);
  const answered = Object.values(responses).filter((value) => value > 0).length;
  const progress = Math.round((answered / allQuestions.length) * 100);

  function updateProfile(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  }

  function updateResponse(questionId: string, value: number) {
    setResponses((current) => ({ ...current, [questionId]: value }));
  }

  async function copySummary() {
    const lines = [
      result.summary,
      "",
      `Bottleneck: ${result.bottleneck.title} (${result.bottleneck.score}/100)`,
      `Estimated cash at risk: ${formatCurrency(result.cashAtRisk)}`,
      `Pipeline without a next step: ${formatCurrency(result.nextStepGap)}`,
      "",
      "Recommended next moves:",
      ...result.recommendations.map((item) => `- ${item}`)
    ];

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-4 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded border border-line bg-paper px-4 py-4 shadow-soft sm:px-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded bg-moss text-sm font-bold text-paper">FP</span>
              <div>
                <p className="text-sm font-bold tracking-tight">FitProof</p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Nonprofit Revenue Pipeline Assessment</h1>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
              <div className="rounded border border-line bg-cream px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Progress</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{progress}%</p>
              </div>
              <div className="rounded border border-line bg-cream px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Index</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{result.total}/100</p>
              </div>
              <div className="col-span-2 rounded border border-line bg-cream px-3 py-2 sm:col-span-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Status</p>
                <p className="mt-1 text-sm font-bold">{result.label}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
          <div className="grid gap-5">
            <section className="rounded border border-line bg-paper p-4 shadow-soft sm:p-5">
              <div className="flex flex-col gap-1 border-b border-line pb-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">Organization snapshot</p>
                <h2 className="text-lg font-bold tracking-tight">Revenue context</h2>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Organization" name="orgName" value={profile.orgName} onChange={updateProfile} placeholder="Community Health Alliance" />
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Primary revenue stream</span>
                  <select
                    name="primaryRevenueStream"
                    value={profile.primaryRevenueStream}
                    onChange={updateProfile}
                    className="min-h-11 rounded border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-moss focus:ring-4 focus:ring-moss/10"
                  >
                    {revenueStreams.map((stream) => (
                      <option key={stream} value={stream}>
                        {stream}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="CRM or tracking system" name="crmSystem" value={profile.crmSystem} onChange={updateProfile} placeholder="Salesforce, Bloomerang, spreadsheets" />
                <Field label="Annual revenue goal" name="annualGoal" value={profile.annualGoal} onChange={updateProfile} placeholder="2500000" type="number" />
                <Field label="Cash received YTD" name="cashReceivedYtd" value={profile.cashReceivedYtd} onChange={updateProfile} placeholder="840000" type="number" />
                <Field label="Open pipeline" name="openPipeline" value={profile.openPipeline} onChange={updateProfile} placeholder="1200000" type="number" />
                <Field label="Committed, not received" name="committedNotReceived" value={profile.committedNotReceived} onChange={updateProfile} placeholder="180000" type="number" />
                <Field label="Overdue commitments" name="overdueCommitments" value={profile.overdueCommitments} onChange={updateProfile} placeholder="45000" type="number" />
                <Field label="Pipeline with no next step (%)" name="noNextStepPercent" value={profile.noNextStepPercent} onChange={updateProfile} placeholder="35" type="number" />
              </div>
            </section>

            {dimensions.map((dimension) => (
              <section key={dimension.id} className="rounded border border-line bg-paper p-4 shadow-soft sm:p-5">
                <div className="grid gap-3 border-b border-line pb-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">{dimension.shortTitle}</p>
                    <h2 className="mt-1 text-lg font-bold tracking-tight">{dimension.title}</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{dimension.description}</p>
                  </div>
                  <div className="rounded border border-line bg-cream px-3 py-2 text-left sm:text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Weight</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{dimension.weight}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {dimension.questions.map((question) => (
                    <div key={question.id} className="rounded border border-line bg-cream p-3">
                      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
                        <div>
                          <p className="text-sm font-semibold leading-6 text-ink">{question.prompt}</p>
                          <p className="mt-1 text-xs leading-5 text-slate">{question.evidence}</p>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {ratingLabels.map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => updateResponse(question.id, index)}
                              title={label}
                              aria-label={`${question.prompt}: ${label}`}
                              className={`h-10 min-w-10 rounded border text-sm font-bold tabular-nums transition ${
                                responses[question.id] === index
                                  ? "border-moss bg-moss text-paper"
                                  : "border-line bg-paper text-ink hover:border-moss hover:text-moss"
                              }`}
                            >
                              {index}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-4">
            <section className="rounded border border-line bg-paper p-5 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">FitProof index</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-6xl font-bold tracking-tight">{result.total}</p>
                  <p className="mt-2 text-sm font-bold text-copper">{result.label}</p>
                </div>
                <button
                  type="button"
                  onClick={copySummary}
                  className="rounded bg-ink px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-moss"
                >
                  {copied ? "Copied" : "Copy summary"}
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate">{result.summary}</p>
            </section>

            <section className="rounded border border-line bg-paper p-5 shadow-soft">
              <h2 className="text-sm font-bold tracking-tight">Proprietary outputs</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded border border-line bg-cream p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Confidence-weighted pipeline</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(result.confidenceWeightedPipeline)}</p>
                </div>
                <div className="rounded border border-line bg-cream p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Cash realization risk</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(result.cashAtRisk)}</p>
                </div>
                <div className="rounded border border-line bg-cream p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">No-next-step exposure</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(result.nextStepGap)}</p>
                </div>
                <div className="rounded border border-line bg-cream p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Goal coverage</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {result.goalCoverage === null ? "Add goal" : `${Math.round(result.goalCoverage * 100)}%`}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded border border-line bg-paper p-5 shadow-soft">
              <h2 className="text-sm font-bold tracking-tight">Dimension scores</h2>
              <div className="mt-4 grid gap-3">
                {result.dimensionScores.map((score) => (
                  <div key={score.id} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{score.shortTitle}</p>
                      <p className="text-sm font-bold tabular-nums">{score.score}</p>
                    </div>
                    <Meter value={score.score} tone={score.score >= 75 ? "green" : score.score >= 50 ? "blue" : "amber"} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-line bg-paper p-5 shadow-soft">
              <h2 className="text-sm font-bold tracking-tight">Revenue leakage map</h2>
              <div className="mt-4 grid gap-3">
                {result.leakageMap.slice(0, 3).map((stage) => (
                  <div key={stage.stage} className="rounded border border-line bg-cream p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{stage.stage}</p>
                      <p className="text-sm font-bold tabular-nums text-copper">{stage.risk}% risk</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate">{stage.diagnosis}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-line bg-paper p-5 shadow-soft">
              <h2 className="text-sm font-bold tracking-tight">30-day advisory roadmap</h2>
              <ol className="mt-4 grid gap-3">
                {result.recommendations.map((item, index) => (
                  <li key={item} className="grid grid-cols-[auto_1fr] gap-3 rounded border border-line bg-cream p-3 text-sm leading-6">
                    <span className="grid size-7 place-items-center rounded bg-paper text-xs font-bold text-moss">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
