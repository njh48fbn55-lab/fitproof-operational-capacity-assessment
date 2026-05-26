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

function Meter({ value }: { value: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: "linear-gradient(90deg, #67a629 0%, #f1c232 55%, #d83131 100%)"
        }}
      />
    </span>
  );
}

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listItems(items: string[]) {
  return items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>No items available.</li>";
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
  const [showSectionValidation, setShowSectionValidation] = useState(false);
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
  const sectionComplete = sectionQuestions.every((question) => hasAnswer(question, responses));
  const missingInSection = sectionQuestions.filter((question) => !hasAnswer(question, responses)).length;

  function isSectionComplete(sectionIndex: number) {
    const targetSection = domains[sectionIndex];
    return questions.filter((question) => question.domainId === targetSection.id).every((question) => hasAnswer(question, responses));
  }

  function goToSection(sectionIndex: number) {
    if (sectionIndex <= currentStep) {
      setCurrentStep(sectionIndex);
      setShowSectionValidation(false);
      setOpenPicklistId(null);
      return;
    }

    const firstIncompleteSection = domains.findIndex((_, index) => index < sectionIndex && !isSectionComplete(index));

    if (firstIncompleteSection >= 0) {
      setCurrentStep(firstIncompleteSection);
      setShowSectionValidation(true);
      setOpenPicklistId(null);
      return;
    }

    setCurrentStep(sectionIndex);
    setShowSectionValidation(false);
    setOpenPicklistId(null);
  }

  function goForward() {
    if (!sectionComplete) {
      setShowSectionValidation(true);
      return;
    }

    setShowSectionValidation(false);
    setOpenPicklistId(null);

    if (currentStep === domains.length - 1) {
      setView("lead");
      return;
    }

    setCurrentStep(currentStep + 1);
  }

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
              A mission-driven diagnostic for nonprofit leaders to identify operational strain, operating constraints, and the next interventions that protect capacity for growth.
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
                    onClick={() => goToSection(index)}
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
                  {showSectionValidation && !sectionComplete && (
                    <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                      Please answer all questions in this section to continue. {missingInSection} remaining.
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4">
                  {sectionQuestions.map((question) => {
                    const missing = showSectionValidation && !hasAnswer(question, responses);
                    const fieldStateClass = missing ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-line focus:border-fitgreen focus:ring-fitgreen/20";

                    return (
                      <div key={question.id} className={`rounded border bg-panel p-3 ${missing ? "border-red-300" : "border-line"}`}>
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
                            aria-invalid={missing}
                            className={`mt-3 w-full rounded border bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-4 ${fieldStateClass}`}
                          />
                        ) : (
                          <>
                            {question.type === "multi" ? (
                              <div className="relative mt-3">
                                <button
                                  type="button"
                                  onClick={() => setOpenPicklistId(openPicklistId === question.id ? null : question.id)}
                                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded border bg-white px-3 py-2 text-left text-sm font-semibold text-ink outline-none transition hover:border-fitgreen focus:ring-4 ${fieldStateClass}`}
                                  aria-expanded={openPicklistId === question.id}
                                  aria-invalid={missing}
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
                                aria-invalid={missing}
                                className={`mt-3 min-h-11 w-full rounded border bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:ring-4 ${fieldStateClass}`}
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
                        {missing && <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">Required</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(Math.max(0, currentStep - 1));
                      setShowSectionValidation(false);
                      setOpenPicklistId(null);
                    }}
                    disabled={currentStep === 0}
                    className="min-h-11 rounded border border-line px-4 text-sm font-bold transition hover:border-fitgreen disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goForward}
                    className="min-h-11 rounded bg-fitgreen px-4 text-sm font-bold text-blacktop transition hover:bg-blacktop hover:text-fitgreen"
                  >
                    {currentStep === domains.length - 1 ? "Continue to findings and report" : "Next section"}
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

  function downloadWordReport() {
    const organization = profile.organization || "Organization";
    const fileName = `${organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "fitproof"}-operational-capacity-report.doc`;
    const sectionRows = result.domainScores
      .map(
        (domain) => `
          <tr>
            <td>${escapeHtml(domain.title)}</td>
            <td>${escapeHtml(domain.risk)}/100</td>
            <td>${escapeHtml(domain.answered)}</td>
          </tr>
        `
      )
      .join("");
    const sourceItems = generatedReport?.sources?.length
      ? generatedReport.sources.map((source) => `<li>${escapeHtml(source.title)}: ${escapeHtml(source.url)}</li>`).join("")
      : "<li>No public website sources were available.</li>";

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(organization)} Operational Capacity Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111111; line-height: 1.45; }
            h1, h2, h3 { color: #111111; }
            h1 { font-size: 28px; margin-bottom: 4px; }
            h2 { font-size: 18px; margin-top: 24px; border-bottom: 1px solid #d8ddd3; padding-bottom: 5px; }
            h3 { font-size: 15px; margin-bottom: 4px; }
            p, li, td, th { font-size: 12px; }
            .eyebrow { color: #67a629; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
            .meta { color: #4b5563; font-size: 11px; }
            .score { display: inline-block; margin-right: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #d8ddd3; padding: 7px; text-align: left; vertical-align: top; }
            th { background: #f2f5ef; }
          </style>
        </head>
        <body>
          <p class="eyebrow">FitProof Executive Diagnostic</p>
          <h1>Operational Capacity Report</h1>
          <p class="meta">${escapeHtml(organization)} | ${escapeHtml(date)} | Report ID ${escapeHtml(reportId)}</p>
          <p class="meta">Email verified: ${escapeHtml(lead.email || "Not provided")}</p>
          <p class="meta">Website reviewed: ${escapeHtml(profile.websiteUrl || "Not provided")}</p>

          <h2>Executive Summary</h2>
          <p>${escapeHtml(summary)}</p>

          <h2>Score Profile</h2>
          <p><span class="score">Operational strain: ${escapeHtml(result.riskScore)}/100</span><span class="score">Stage ${escapeHtml(result.stage.number)}: ${escapeHtml(result.stage.name)}</span></p>

          ${generatedReport?.organizationSnapshot ? `<h2>Organization Snapshot</h2><p>${escapeHtml(generatedReport.organizationSnapshot)}</p>` : ""}
          ${generatedReport?.missionImplications ? `<h2>Mission Implications</h2><p>${escapeHtml(generatedReport.missionImplications)}</p>` : ""}
          ${generatedReport?.strainDiagnosis ? `<h2>Operational Strain Diagnosis</h2><p>${escapeHtml(generatedReport.strainDiagnosis)}</p>` : ""}

          <h2>Section Scorecard</h2>
          <table>
            <thead><tr><th>Section</th><th>Strain</th><th>Responses</th></tr></thead>
            <tbody>${sectionRows}</tbody>
          </table>

          <h2>Primary Strain Drivers</h2>
          ${
            generatedReport?.primaryStrainDrivers?.length
              ? generatedReport.primaryStrainDrivers
                  .map(
                    (driver) => `
                      <h3>${escapeHtml(driver.category)}</h3>
                      <p><strong>What the strain appears to be:</strong> ${escapeHtml(driver.strain)}</p>
                      <p><strong>Evidence:</strong> ${escapeHtml(driver.evidence)}</p>
                      <p><strong>Why it matters:</strong> ${escapeHtml(driver.whyItMatters)}</p>
                      <p><strong>If not addressed:</strong> ${escapeHtml(driver.consequence)}</p>
                    `
                  )
                  .join("")
              : `<ul>${listItems(risks)}</ul>`
          }

          <h2>Top Operational Strain Risks</h2>
          <ul>${listItems(risks)}</ul>

          <h2>How to Interrupt the Spiral</h2>
          <p>${escapeHtml(recommendation.primary)}</p>
          <ul>${listItems(actions)}</ul>

          <h2>Recommended FitProof Engagement</h2>
          <p><strong>Recommended Offering:</strong> ${escapeHtml(generatedReport?.recommendedEngagement?.recommendedOffering || generatedReport?.fitProofEngagement || recommendation.cta)}</p>
          ${
            generatedReport?.recommendedEngagement
              ? `
                <p><strong>Why This Offering Fits:</strong> ${escapeHtml(generatedReport.recommendedEngagement.whyThisOfferingFits)}</p>
                <p><strong>Primary Objectives:</strong></p><ul>${listItems(generatedReport.recommendedEngagement.primaryObjectives)}</ul>
                <p><strong>Initial Workplan:</strong></p><ul>${listItems(generatedReport.recommendedEngagement.initialWorkplan)}</ul>
                <p><strong>Expected Outcomes:</strong></p><ul>${listItems(generatedReport.recommendedEngagement.expectedOutcomes)}</ul>
                <p><strong>Suggested Timeline:</strong> ${escapeHtml(generatedReport.recommendedEngagement.suggestedTimeline)}</p>
                <p><strong>Why Now:</strong> ${escapeHtml(generatedReport.recommendedEngagement.whyNow)}</p>
              `
              : ""
          }

          <h2>Next 30-60 Days</h2>
          <ul>${listItems(generatedReport?.nextSteps?.length ? generatedReport.nextSteps : actions)}</ul>

          ${generatedReport?.publicSignals?.length ? `<h2>Public Signals Reviewed</h2><ul>${listItems(generatedReport.publicSignals)}</ul>` : ""}
          <h2>Sources</h2>
          <ul>${sourceItems}</ul>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <article id="generated-report" className="mx-auto grid max-w-5xl gap-5 rounded border border-line bg-white p-5 shadow-soft print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-start">
          <span className="grid h-16 w-28 place-items-center rounded border border-line bg-white px-3">
            <img src="/fitproof-logo-trimmed.png" alt="FitProof" className="h-11 w-auto object-contain" />
          </span>
          <div className="sm:pl-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Executive diagnostic</p>
            <h2 className="mt-1 text-3xl font-bold lowercase tracking-tight">operational capacity report</h2>
            <p className="mt-2 text-sm text-slate">{profile.organization || "Organization"} • {date}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate">Report ID {reportId}</p>
            {leadSaved && <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-fitgreen">Email verified: {lead.email}</p>}
            {profile.websiteUrl && <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate">Website reviewed: {profile.websiteUrl}</p>}
          </div>
        </div>
        <button type="button" onClick={downloadWordReport} className="min-h-11 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop print:hidden">
          Download Word Report
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

      <section className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <OperationalGauge strain={result.riskScore} />
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
        <section className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Organization Snapshot</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.organizationSnapshot}</p>
        </section>
      )}

      {generatedReport?.strainDiagnosis && (
        <section className="rounded border border-line bg-panel p-4">
          <h3 className="text-lg font-bold">Spiral Stage Diagnosis</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.strainDiagnosis}</p>
        </section>
      )}

      {generatedReport?.primaryStrainDrivers?.length ? (
        <section>
          <h3 className="text-lg font-bold">Primary Strain Drivers</h3>
          <div className="mt-3 grid gap-3">
            {generatedReport.primaryStrainDrivers.map((driver) => (
              <div key={driver.category} className="rounded border border-line p-4">
                <h4 className="text-base font-bold">{driver.category}</h4>
                <div className="mt-3 grid gap-3 text-sm leading-6 text-slate md:grid-cols-2">
                  <p><strong className="text-ink">What the strain appears to be:</strong> {driver.strain}</p>
                  <p><strong className="text-ink">Evidence:</strong> {driver.evidence}</p>
                  <p><strong className="text-ink">Why it matters:</strong> {driver.whyItMatters}</p>
                  <p><strong className="text-ink">If not addressed:</strong> {driver.consequence}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {generatedReport?.missionImplications && (
        <section className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Implications for the Organization</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.missionImplications}</p>
        </section>
      )}

      <section>
        <h3 className="text-lg font-bold">Section Strain Scorecard</h3>
        <div className="mt-3 grid gap-3">
          {result.domainScores.map((domain) => (
            <div key={domain.id} className="grid gap-2 rounded border border-line p-3 sm:grid-cols-[220px_1fr_72px] sm:items-center">
              <div>
                <p className="text-sm font-bold">{domain.title}</p>
                <p className="text-xs text-slate">{domain.answered} scored responses</p>
              </div>
              <Meter value={domain.risk} />
              <p className="text-right text-sm font-bold tabular-nums">{domain.risk}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Top Operational Strain Risks</h3>
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
            Staffing strain is reflected through overtime, firefighting, bottlenecks, role coverage, and turnover visibility. Knowledge infrastructure strain is reflected through repository reliability, documentation access, SOP currency, onboarding readiness, and change communication.
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
        <h3 className="mt-2 text-2xl font-bold">{generatedReport?.recommendedEngagement?.recommendedOffering || generatedReport?.fitProofEngagement || recommendation.cta}</h3>
        {generatedReport?.recommendedEngagement ? (
          <div className="mt-3 grid gap-3 text-sm leading-6 text-white/75 print:text-slate md:grid-cols-2">
            <p><strong className="text-white print:text-ink">Why This Offering Fits:</strong> {generatedReport.recommendedEngagement.whyThisOfferingFits}</p>
            <p><strong className="text-white print:text-ink">Suggested Timeline:</strong> {generatedReport.recommendedEngagement.suggestedTimeline}</p>
            <div>
              <p className="font-bold text-white print:text-ink">Primary Objectives:</p>
              <ul className="mt-1 grid gap-1">
                {generatedReport.recommendedEngagement.primaryObjectives.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <p className="font-bold text-white print:text-ink">Initial Workplan:</p>
              <ul className="mt-1 grid gap-1">
                {generatedReport.recommendedEngagement.initialWorkplan.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <p className="font-bold text-white print:text-ink">Expected Outcomes:</p>
              <ul className="mt-1 grid gap-1">
                {generatedReport.recommendedEngagement.expectedOutcomes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <p className="md:col-span-2"><strong className="text-white print:text-ink">Why Now:</strong> {generatedReport.recommendedEngagement.whyNow}</p>
          </div>
        ) : (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75 print:text-slate">
            Schedule a FitProof Operational Strain Review to turn the diagnostic into a prioritized operating plan.
          </p>
        )}
      </section>

      <section className="rounded border border-line bg-mist p-4">
        <h3 className="text-lg font-bold">Next 30-60 Days</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {(generatedReport?.nextSteps?.length ? generatedReport.nextSteps : actions).map((step) => (
            <p key={step} className="rounded border border-fitgreen/40 bg-white px-3 py-2 text-sm font-semibold text-ink">
              {step}
            </p>
          ))}
        </div>
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

function OperationalGauge({ strain }: { strain: number }) {
  const clampedStrain = Math.max(0, Math.min(100, strain));
  const angle = ((180 - clampedStrain * 1.8) * Math.PI) / 180;
  const centerX = 150;
  const centerY = 128;
  const pointerLength = 92;
  const pointerX = centerX + Math.cos(angle) * pointerLength;
  const pointerY = centerY - Math.sin(angle) * pointerLength;

  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Operational strain</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-charcoal">{strain}<span className="text-base text-slate">/100</span></p>
        </div>
        <p className="max-w-48 text-right text-xs font-semibold leading-5 text-slate">Lower scores indicate less operating pressure. Higher scores indicate more urgent strain.</p>
      </div>

      <div className="mx-auto mt-3 w-[66%]">
        <svg viewBox="0 0 300 168" role="img" aria-label={`Operational strain ${strain} out of 100`} className="h-auto w-full">
          <defs>
            <linearGradient id="capacityGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#67a629" />
              <stop offset="50%" stopColor="#f1c232" />
              <stop offset="100%" stopColor="#d83131" />
            </linearGradient>
          </defs>
          <path d="M 34 128 A 116 116 0 0 1 266 128" fill="none" stroke="#d8ddd3" strokeWidth="18" strokeLinecap="round" />
          <path d="M 34 128 A 116 116 0 0 1 266 128" fill="none" stroke="url(#capacityGaugeGradient)" strokeWidth="18" strokeLinecap="round" />
          <line x1={centerX} y1={centerY} x2={pointerX} y2={pointerY} stroke="#111111" strokeWidth="4" strokeLinecap="round" />
          <circle cx={centerX} cy={centerY} r="8" fill="#111111" />
          <circle cx={pointerX} cy={pointerY} r="7" fill="#ffffff" stroke="#111111" strokeWidth="3" />
          <text x="30" y="153" fontSize="12" fontWeight="700" fill="#4b5563">0 low strain</text>
          <text x="270" y="153" textAnchor="end" fontSize="12" fontWeight="700" fill="#4b5563">100 severe strain</text>
        </svg>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate">
        The pointer shows where the organization sits on the operational strain scale based on the completed assessment.
      </p>
    </div>
  );
}
