"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  AssessmentResult,
  domains,
  generateExecutiveSummary,
  generateRisks,
  getQuestionOptions,
  getOpenConstraint,
  GeneratedExecutiveReport,
  Lead,
  Profile,
  Question,
  questions,
  Responses,
  scoreAssessment,
  stageRecommendations
} from "@/lib/operational-capacity";

const emptyProfile: Profile = {
  organization: "",
  websiteUrl: ""
};

const emptyLead: Lead = {
  email: ""
};

type View = "assessment" | "lead" | "report";

const questionNumbers = questions.reduce<Record<string, number>>((numbers, question, index) => {
  numbers[question.id] = index + 1;
  return numbers;
}, {});

function Meter({ value, tone = "teal" }: { value: number; tone?: "teal" | "amber" }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
      <span className={`block h-full rounded-full ${tone === "amber" ? "bg-charcoal" : "bg-fitgreen"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-fitgreen focus:ring-4 focus:ring-fitgreen/20"
      />
    </label>
  );
}

function hasAnswer(question: Question, responses: Responses) {
  const value = responses[question.id];
  if (question.type === "multi") return (Array.isArray(value) && value.length > 0) || (typeof value === "string" && value.trim().length > 0);
  return typeof value === "string" && value.trim().length > 0;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [lead, setLead] = useState<Lead>(emptyLead);
  const [responses, setResponses] = useState<Responses>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [view, setView] = useState<View>("assessment");
  const [leadSaved, setLeadSaved] = useState(false);
  const [openPicklistId, setOpenPicklistId] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedExecutiveReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const result = useMemo(() => scoreAssessment(responses), [responses]);
  const completed = questions.filter((question) => hasAnswer(question, responses)).length;
  const progress = Math.round((completed / questions.length) * 100);

  function setAnswer(question: Question, value: string) {
    setResponses({ ...responses, [question.id]: value });
  }

  function setMultiAnswer(question: Question, values: string[]) {
    setResponses({ ...responses, [question.id]: values });
  }

  function toggleMultiAnswer(question: Question, value: string) {
    const current = Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : [];
    const unknownLabel = "I don't know";

    if (value === unknownLabel) {
      setMultiAnswer(question, current.includes(unknownLabel) ? [] : [unknownLabel]);
      return;
    }

    const withoutUnknown = current.filter((item) => item !== unknownLabel);
    const next = withoutUnknown.includes(value) ? withoutUnknown.filter((item) => item !== value) : [...withoutUnknown, value];
    setMultiAnswer(question, next);
  }

  async function submitLead() {
    setView("report");
    setIsGeneratingReport(true);
    setReportError("");

    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, profile, result })
      });
      setLeadSaved(true);

      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, profile, responses, result })
      });

      if (!response.ok) {
        throw new Error("Report generation failed.");
      }

      const data = (await response.json()) as GeneratedExecutiveReport;
      setGeneratedReport(data);
    } catch (error) {
      console.error(error);
      setReportError("The AI report could not be generated, so the deterministic executive report is shown instead.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  const section = domains[currentStep];
  const sectionQuestions = questions.filter((question) => question.domainId === section.id);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="bg-blacktop px-4 py-5 text-white sm:px-6 lg:px-8 print:hidden">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_390px] lg:items-end">
          <div>
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-28 place-items-center rounded border border-white/10 bg-white px-3 shadow-soft">
                <img src="/fitproof-logo-trimmed.png" alt="FitProof" className="h-10 w-auto object-contain" />
              </span>
              <div>
                <p className="text-sm font-bold text-fitgreen">FitProof</p>
                <h1 className="text-2xl font-bold lowercase tracking-tight sm:text-3xl">operational capacity assessment</h1>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
              A mission-driven diagnostic for nonprofit leaders to identify operational maturity, strain risk, and the next interventions that protect capacity for growth.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Assessment progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-fitgreen transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-white/55">Risk</p>
                <p className="mt-1 text-lg font-bold">{result.riskScore}</p>
              </div>
              <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-white/55">Maturity</p>
                <p className="mt-1 text-lg font-bold">{result.maturityScore}</p>
              </div>
              <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.12em] text-white/55">Stage</p>
                <p className="mt-1 text-lg font-bold">{result.stage.number}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 print:px-0 print:py-0">
        {view === "assessment" && (
          <div className="grid gap-5">
            <section className="rounded border border-line bg-white p-4 shadow-soft sm:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Organization" value={profile.organization} onChange={(value) => setProfile({ ...profile, organization: value })} />
                <Field label="Organization website" value={profile.websiteUrl} onChange={(value) => setProfile({ ...profile, websiteUrl: value })} />
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[245px_minmax(0,1fr)]">
              <nav className="rounded border border-line bg-white p-2 shadow-soft lg:sticky lg:top-4 lg:self-start" aria-label="Assessment sections">
                {domains.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`mb-1 grid w-full grid-cols-[30px_1fr] items-center gap-2 rounded px-2 py-2 text-left text-sm transition ${
                      index === currentStep ? "bg-mist font-bold text-ink" : "text-slate hover:bg-panel hover:text-ink"
                    }`}
                  >
                    <span className={`grid size-7 place-items-center rounded text-xs font-bold ${index === currentStep ? "bg-fitgreen text-blacktop" : "bg-panel text-slate"}`}>
                      {index + 1}
                    </span>
                    <span>{item.shortTitle}</span>
                  </button>
                ))}
              </nav>

              <section className="rounded border border-line bg-white p-4 shadow-soft sm:p-5">
                <div className="border-b border-line pb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Section weight {section.weight}%</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">{section.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate">{section.purpose}</p>
                </div>

                <div className="mt-4 grid gap-4">
                  {sectionQuestions.map((question) => (
                    <div key={question.id} className="rounded border border-line bg-panel p-3">
                      <p className="text-sm font-semibold leading-6">
                        <span className="mr-2 inline-grid size-6 place-items-center rounded bg-blacktop text-xs font-bold text-fitgreen">
                          {questionNumbers[question.id]}
                        </span>
                        {question.prompt}
                      </p>
                      {question.type === "text" ? (
                        <textarea
                          value={(responses[question.id] as string) || ""}
                          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setAnswer(question, event.target.value)}
                          rows={4}
                          className="mt-3 w-full rounded border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-fitgreen focus:ring-4 focus:ring-fitgreen/20"
                        />
                      ) : (
                        <>
                          {question.type === "multi" ? (
                            <div className="relative mt-3">
                              <button
                                type="button"
                                onClick={() => setOpenPicklistId(openPicklistId === question.id ? null : question.id)}
                                className="flex min-h-11 w-full items-center justify-between gap-3 rounded border border-line bg-white px-3 py-2 text-left text-sm font-semibold text-ink outline-none transition hover:border-fitgreen focus:border-fitgreen focus:ring-4 focus:ring-fitgreen/20"
                                aria-expanded={openPicklistId === question.id}
                              >
                                <span>
                                  {Array.isArray(responses[question.id]) && (responses[question.id] as string[]).length > 0
                                    ? (responses[question.id] as string[]).join(", ")
                                    : "Select one or more responses"}
                                </span>
                                <span className="text-xs text-slate">{openPicklistId === question.id ? "Close" : "Open"}</span>
                              </button>

                              {openPicklistId === question.id && (
                                <div className="absolute z-10 mt-2 grid max-h-72 w-full gap-1 overflow-y-auto rounded border border-line bg-white p-2 shadow-soft">
                                  {getQuestionOptions(question).map((option) => {
                                    const selected = Array.isArray(responses[question.id]) && (responses[question.id] as string[]).includes(option.label);

                                    return (
                                      <label key={option.label} className="flex min-h-10 cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm font-semibold text-ink hover:bg-mist">
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={() => toggleMultiAnswer(question, option.label)}
                                          className="size-4 accent-fitgreen"
                                        />
                                        <span>{option.label}</span>
                                      </label>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => setOpenPicklistId(null)}
                                    className="mt-1 min-h-10 rounded bg-blacktop px-3 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop"
                                  >
                                    Done
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <select
                              value={(responses[question.id] as string) || ""}
                              onChange={(event: ChangeEvent<HTMLSelectElement>) => setAnswer(question, event.target.value)}
                              className="mt-3 min-h-11 w-full rounded border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-fitgreen focus:ring-4 focus:ring-fitgreen/20"
                            >
                              <option value="">Select a response</option>
                              {getQuestionOptions(question).map((option) => (
                                <option key={option.label} value={option.label}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="min-h-11 rounded border border-line px-4 text-sm font-bold transition hover:border-fitgreen disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => (currentStep === domains.length - 1 ? setView("lead") : setCurrentStep(currentStep + 1))}
                    className="min-h-11 rounded bg-fitgreen px-4 text-sm font-bold text-blacktop transition hover:bg-blacktop hover:text-fitgreen"
                  >
                    {currentStep === domains.length - 1 ? "Continue to lead capture" : "Next section"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {view === "lead" && <LeadCapture lead={lead} onLeadChange={setLead} onBack={() => setView("assessment")} onSubmit={submitLead} />}

        {view === "report" && (
          <Report
            profile={profile}
            responses={responses}
            result={result}
            lead={lead}
            leadSaved={leadSaved}
            generatedReport={generatedReport}
            isGeneratingReport={isGeneratingReport}
            reportError={reportError}
          />
        )}
      </div>
    </main>
  );
}

function LeadCapture({
  lead,
  onLeadChange,
  onBack,
  onSubmit
}: {
  lead: Lead;
  onLeadChange: (lead: Lead) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = lead.email.includes("@") && lead.email.includes(".");

  return (
    <section className="mx-auto grid max-w-3xl gap-4 rounded border border-line bg-white p-5 shadow-soft">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Report access</p>
        <h2 className="mt-1 text-2xl font-bold lowercase tracking-tight">verify your email</h2>
        <p className="mt-2 text-sm leading-6 text-slate">Enter your email to unlock the executive diagnostic report.</p>
      </div>
      <div className="grid gap-3">
        <Field label="Email" value={lead.email} type="email" onChange={(value) => onLeadChange({ email: value })} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className="min-h-11 rounded border border-line px-4 text-sm font-bold transition hover:border-fitgreen">
          Back
        </button>
        <button type="button" disabled={!canSubmit} onClick={onSubmit} className="min-h-11 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop disabled:cursor-not-allowed disabled:opacity-45">
          Unlock report
        </button>
      </div>
    </section>
  );
}

function Report({
  profile,
  responses,
  result,
  lead,
  leadSaved,
  generatedReport,
  isGeneratingReport,
  reportError
}: {
  profile: Profile;
  responses: Responses;
  result: AssessmentResult;
  lead: Lead;
  leadSaved: boolean;
  generatedReport: GeneratedExecutiveReport | null;
  isGeneratingReport: boolean;
  reportError: string;
}) {
  const recommendation = stageRecommendations[result.stage.number];
  const summary = generatedReport?.executiveSummary || generateExecutiveSummary(profile, result);
  const risks = generatedReport?.topRisks?.length ? generatedReport.topRisks : generateRisks(result);
  const actions = generatedReport?.recommendations?.length ? generatedReport.recommendations : recommendation.actions;
  const openConstraint = getOpenConstraint(responses);
  const date = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const reportId = `FP-OCA-${date.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;

  function downloadPdf() {
    const previousTitle = document.title;
    document.title = `${profile.organization || "FitProof"} Operational Capacity Report`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  return (
    <article id="generated-report" className="mx-auto grid max-w-5xl gap-5 rounded border border-line bg-white p-5 shadow-soft print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-[96px_1fr] sm:items-start">
          <span className="grid h-16 w-28 place-items-center rounded border border-line bg-white px-3">
            <img src="/fitproof-logo-trimmed.png" alt="FitProof" className="h-11 w-auto object-contain" />
          </span>
          <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Executive diagnostic</p>
          <h2 className="mt-1 text-3xl font-bold lowercase tracking-tight">operational capacity report</h2>
          <p className="mt-2 text-sm text-slate">{profile.organization || "Organization"} • {date}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate">Report ID {reportId}</p>
          {leadSaved && <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-fitgreen">Email verified: {lead.email}</p>}
          {profile.websiteUrl && <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate">Website reviewed: {profile.websiteUrl}</p>}
          </div>
        </div>
        <button type="button" onClick={downloadPdf} className="min-h-11 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop print:hidden">
          Download PDF
        </button>
      </div>

      {isGeneratingReport && (
        <section className="rounded border border-fitgreen/40 bg-fitgreen/10 p-4">
          <h3 className="text-lg font-bold">Generating Organization-Specific Report</h3>
          <p className="mt-2 text-sm leading-6 text-slate">FitProof is reviewing the assessment data and available public website content to create a tailored executive narrative.</p>
        </section>
      )}

      {(reportError || generatedReport?.fallbackReason) && (
        <section className="rounded border border-line bg-panel p-4">
          <h3 className="text-lg font-bold">Report Generation Note</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{reportError || generatedReport?.fallbackReason}</p>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <ScoreCard label="Operational maturity" value={result.maturityScore} suffix="/100" />
        <ScoreCard label="Operational strain risk" value={result.riskScore} suffix="/100" tone="amber" />
        <div className="rounded border border-line bg-panel p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Spiral stage</p>
          <p className="mt-2 text-2xl font-bold">Stage {result.stage.number}</p>
          <p className="mt-1 text-sm font-bold text-fitgreen">{result.stage.name}</p>
        </div>
      </section>

      <section className="rounded border border-line bg-panel p-4">
        <h3 className="text-lg font-bold">Executive Summary</h3>
        <p className="mt-2 text-sm leading-6 text-slate">{summary}</p>
      </section>

      {generatedReport && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-line p-4">
            <h3 className="text-lg font-bold">Organization Snapshot</h3>
            <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.organizationSnapshot}</p>
          </div>
          <div className="rounded border border-line p-4">
            <h3 className="text-lg font-bold">Mission Implications</h3>
            <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.missionImplications}</p>
          </div>
        </section>
      )}

      {generatedReport?.strainDiagnosis && (
        <section className="rounded border border-line bg-panel p-4">
          <h3 className="text-lg font-bold">Operational Strain Diagnosis</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.strainDiagnosis}</p>
        </section>
      )}

      <section>
        <h3 className="text-lg font-bold">Section Scorecard</h3>
        <div className="mt-3 grid gap-3">
          {result.domainScores.map((domain) => (
            <div key={domain.id} className="grid gap-2 rounded border border-line p-3 sm:grid-cols-[220px_1fr_72px] sm:items-center">
              <div>
                <p className="text-sm font-bold">{domain.title}</p>
                <p className="text-xs text-slate">{domain.answered} scored responses</p>
              </div>
              <Meter value={domain.maturity} tone={domain.risk >= 60 ? "amber" : "teal"} />
              <p className="text-right text-sm font-bold tabular-nums">{domain.maturity}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Top Operational Risks</h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
            {risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
          {result.flags.length > 0 && (
            <div className="mt-4 rounded border border-fitgreen/60 bg-fitgreen/10 p-3 text-sm leading-6 text-ink">
              {result.flags.map((flag) => (
                <p key={flag}>{flag}</p>
              ))}
            </div>
          )}
        </div>
        <div className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Staffing & Knowledge Signals</h3>
          <p className="mt-3 text-sm leading-6 text-slate">
            Staffing strain is reflected through overtime, firefighting, bottlenecks, role coverage, and turnover visibility. Knowledge infrastructure is reflected through repository maturity, documentation access, SOP currency, onboarding readiness, and change communication.
          </p>
          {openConstraint && (
            <div className="mt-4 rounded border border-line bg-panel p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Stated constraint</p>
              <p className="mt-1 text-sm leading-6 text-ink">{openConstraint}</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded border border-line bg-mist p-4">
        <h3 className="text-lg font-bold">How to Interrupt the Spiral</h3>
        <p className="mt-2 text-sm font-semibold text-ink">{recommendation.primary}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {actions.map((action) => (
            <p key={action} className="rounded border border-fitgreen/40 bg-white px-3 py-2 text-sm font-semibold text-ink">
              {action}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded border border-line bg-blacktop p-4 text-white print:bg-white print:text-ink">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Recommended FitProof engagement</p>
        <h3 className="mt-2 text-2xl font-bold">{generatedReport?.fitProofEngagement || recommendation.cta}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75 print:text-slate">
          Schedule a FitProof Operational Capacity Review to turn the diagnostic into a prioritized operating plan.
        </p>
      </section>

      {generatedReport && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-line p-4">
            <h3 className="text-lg font-bold">Public Signals Reviewed</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
              {generatedReport.publicSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-line p-4">
            <h3 className="text-lg font-bold">Sources</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
              {generatedReport.sources.length ? (
                generatedReport.sources.map((source) => (
                  <li key={source.url}>
                    {source.title}: {source.url}
                  </li>
                ))
              ) : (
                <li>No public website sources were available.</li>
              )}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}

function ScoreCard({ label, value, suffix, tone = "teal" }: { label: string; value: number; suffix: string; tone?: "teal" | "amber" }) {
  return (
    <div className="rounded border border-line bg-panel p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{label}</p>
      <p className={`mt-2 text-4xl font-bold tabular-nums ${tone === "amber" ? "text-charcoal" : "text-fitgreen"}`}>
        {value}
        <span className="text-lg text-slate">{suffix}</span>
      </p>
    </div>
  );
}
