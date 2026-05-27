"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { AuditExtraction } from "@/lib/nonprofit-viability/types";
import { scoreToGaugeRotation } from "@/lib/report-gauge";
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
  stageRecommendations,
  systemCategories,
  integrationOptions,
  isSystemMappingResponse,
  reportingConfidenceOptions,
  selectedSystemTools,
  SystemCategory,
  SystemMappingResponse
} from "@/lib/operational-capacity";

const emptyProfile: Profile = {
  organization: "",
  websiteUrl: ""
};

const emptyLead: Lead = {
  email: ""
};

type View = "assessment" | "lead" | "report";

type AnalysisJobStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string;
  progressPercent: number;
  errorMessage?: string | null;
};

const loadingMessages = [
  "Reviewing assessment responses...",
  "Searching for public financial data...",
  "Checking available annual and impact reports...",
  "Reviewing website and program signals...",
  "Looking for public hiring and workforce indicators...",
  "Synthesizing operational health, growth readiness, and strain signals...",
  "Preparing your executive report..."
];

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

function wordGaugeHtml(label: string, value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  return `
    <div class="word-gauge">
      <div class="word-gauge-head">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(clamped)}/100</span>
      </div>
      <div class="word-gauge-track">
        <span class="word-gauge-needle" style="left: ${clamped}%"></span>
      </div>
      <div class="word-gauge-scale"><span>0</span><span>50</span><span>100</span></div>
    </div>
  `;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  invalid = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  invalid?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className={`min-h-11 rounded border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:ring-4 ${
          invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-line focus:border-fitgreen focus:ring-fitgreen/20"
        }`}
      />
      {invalid && <span className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">Required</span>}
    </label>
  );
}

function hasAnswer(question: Question, responses: Responses) {
  if (question.optional) return true;
  const value = responses[question.id];
  const validOptions = new Set(getQuestionOptions(question).map((option) => option.label));

  if (question.type === "text") {
    return typeof value === "string" && value.trim().length > 0;
  }

  if (question.type === "systems-map") {
    if (!isSystemMappingResponse(value)) return false;
    const toolsComplete = systemCategories.every((category) => {
      const selected = selectedSystemTools(value, category.id);
      if (!selected.length) return false;
      return !selected.includes("Other") || Boolean(value.otherTools?.[category.id]?.trim());
    });
    return Boolean(toolsComplete && value.integration && value.reportConfidence);
  }

  if (question.type === "multi") {
    if (Array.isArray(value)) {
      const hasValid = value.some((item) => validOptions.has(item));
      if (question.allowOther && value.includes("Other")) return hasValid && Boolean((responses[`${question.id}__other`] as string | undefined)?.trim());
      return hasValid;
    }
    return typeof value === "string" && validOptions.has(value);
  }

  return typeof value === "string" && validOptions.has(value);
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
  const [activeHelpQuestion, setActiveHelpQuestion] = useState<Question | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState("");
  const [analysisJobStatus, setAnalysisJobStatus] = useState<AnalysisJobStatus | null>(null);
  const [uploadedAuditExtractions, setUploadedAuditExtractions] = useState<AuditExtraction[]>([]);
  const [uploadNote, setUploadNote] = useState("");
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

  function setSystemMapping(updates: Partial<SystemMappingResponse>) {
    const current = isSystemMappingResponse(responses["core-systems"]) ? responses["core-systems"] : {};
    setResponses({ ...responses, "core-systems": { ...current, ...updates } });
  }

  function toggleSystemTool(category: SystemCategory, value: string) {
    const current = isSystemMappingResponse(responses["core-systems"]) ? responses["core-systems"] : {};
    const existing = selectedSystemTools(current, category);
    const exclusive = value === "None" || value === "I don't know";
    const next = exclusive
      ? existing.includes(value) ? [] : [value]
      : existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing.filter((item) => item !== "None" && item !== "I don't know"), value];
    const otherTools = next.includes("Other") ? current.otherTools : { ...current.otherTools, [category]: "" };
    setSystemMapping({ tools: { ...current.tools, [category]: next }, otherTools });
  }

  function setSystemOtherTool(category: SystemCategory, value: string) {
    const current = isSystemMappingResponse(responses["core-systems"]) ? responses["core-systems"] : {};
    setSystemMapping({ otherTools: { ...current.otherTools, [category]: value } });
  }

  async function submitLead() {
    setView("report");
    setIsGeneratingReport(true);
    setReportError("");
    setGeneratedReport(null);
    setAnalysisJobStatus(null);

    try {
      const response = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, profile, responses, result, uploadedAuditExtractions })
      });

      if (!response.ok) {
        throw new Error("Analysis job could not be started.");
      }

      const data = await response.json();
      setAnalysisJobId(data.jobId);
      setAnalysisJobStatus({
        id: data.jobId,
        status: data.status,
        currentStep: data.currentStep,
        progressPercent: data.progressPercent
      });
    } catch (error) {
      console.error(error);
      setReportError("Enhanced analysis could not be started. Please try again.");
      setIsGeneratingReport(false);
    }
  }

  async function uploadAnnualReport(file: File | null) {
    if (!file) return;
    setUploadNote("Uploading and reading the document...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("organizationName", profile.organization || "organization");

    try {
      const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed.");
      const data = await response.json();
      setUploadedAuditExtractions((current) => [...current, data.extraction]);
      setUploadNote("Uploaded report will be prioritized in the analysis.");
    } catch (error) {
      console.error(error);
      setUploadNote("The report could not be uploaded. You can continue; the public website scan will still run.");
    }
  }

  useEffect(() => {
    if (!analysisJobId || view !== "report" || generatedReport) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/analysis/jobs/${analysisJobId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load job status.");
        const job = (await response.json()) as AnalysisJobStatus;
        if (cancelled) return;
        setAnalysisJobStatus(job);

        if (job.status === "completed") {
          const resultsResponse = await fetch(`/api/analysis/jobs/${analysisJobId}/results`, { cache: "no-store" });
          if (!resultsResponse.ok) throw new Error("Unable to load completed report.");
          const results = await resultsResponse.json();
          setGeneratedReport(results.report);
          setLeadSaved(true);
          setIsGeneratingReport(false);
          return;
        }

        if (job.status === "failed") {
          setReportError(job.errorMessage || "Enhanced analysis failed.");
          setIsGeneratingReport(false);
          return;
        }

        window.setTimeout(poll, 3500);
      } catch (error) {
        console.error(error);
        if (!cancelled) window.setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [analysisJobId, analysisJobStatus?.status, generatedReport, view]);

  async function retryAnalysis() {
    if (!analysisJobId) return;
    setReportError("");
    setIsGeneratingReport(true);
    setGeneratedReport(null);

    const response = await fetch(`/api/analysis/jobs/${analysisJobId}/retry`, { method: "POST" });
    if (!response.ok) {
      setReportError("Retry could not be started.");
      setIsGeneratingReport(false);
      return;
    }

    setAnalysisJobStatus({
      id: analysisJobId,
      status: "queued",
      currentStep: "queued",
      progressPercent: 0
    });
  }

  const section = domains[currentStep];
  const sectionQuestions = questions.filter((question) => question.domainId === section.id);
  const profileComplete = profile.organization.trim().length > 0 && profile.websiteUrl.trim().length > 0;
  const sectionQuestionComplete = sectionQuestions.every((question) => hasAnswer(question, responses));
  const sectionComplete = sectionQuestionComplete && (currentStep !== 0 || profileComplete);
  const missingProfileFields = currentStep === 0 ? Number(!profile.organization.trim()) + Number(!profile.websiteUrl.trim()) : 0;
  const missingInSection = sectionQuestions.filter((question) => !hasAnswer(question, responses)).length + missingProfileFields;

  function isSectionComplete(sectionIndex: number) {
    const targetSection = domains[sectionIndex];
    const targetSectionComplete = questions.filter((question) => question.domainId === targetSection.id).every((question) => hasAnswer(question, responses));
    return targetSectionComplete && (sectionIndex !== 0 || profileComplete);
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
              {currentStep === 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Organization"
                    value={profile.organization}
                    invalid={showSectionValidation && !profile.organization.trim()}
                    onChange={(value) => setProfile({ ...profile, organization: value })}
                  />
                  <Field
                    label="Organization website"
                    value={profile.websiteUrl}
                    invalid={showSectionValidation && !profile.websiteUrl.trim()}
                    onChange={(value) => setProfile({ ...profile, websiteUrl: value })}
                  />
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Upload annual report or audit PDF (optional)</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => void uploadAnnualReport(event.target.files?.[0] || null)}
                      className="min-h-11 rounded border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition file:mr-3 file:rounded file:border-0 file:bg-blacktop file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-fitgreen focus:border-fitgreen focus:ring-4 focus:ring-fitgreen/20"
                    />
                    {uploadNote && <span className="text-xs font-semibold text-slate">{uploadNote}</span>}
                    {uploadedAuditExtractions.length > 0 && <span className="text-xs font-bold uppercase tracking-[0.12em] text-fitgreen">{uploadedAuditExtractions.length} document uploaded</span>}
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Organization</p>
                    <p className="mt-1 min-h-11 rounded border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink">{profile.organization}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Organization website</p>
                    <p className="mt-1 min-h-11 rounded border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink">{profile.websiteUrl}</p>
                  </div>
                </div>
              )}
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
                      Please answer all questions in this section to continue. {missingInSection} remaining. "Select a response" does not count as an answer.
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4">
                  {sectionQuestions.map((question) => {
                    const missing = showSectionValidation && !hasAnswer(question, responses);
                    const fieldStateClass = missing ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-line focus:border-fitgreen focus:ring-fitgreen/20";

                    return (
                      <div key={question.id} className={`rounded border bg-panel p-3 ${missing ? "border-red-300" : "border-line"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-6">
                            <span className="mr-2 inline-grid size-6 place-items-center rounded bg-blacktop text-xs font-bold text-fitgreen">
                              {questionNumbers[question.id]}
                            </span>
                            {question.prompt}
                            {question.optional && <span className="ml-2 text-xs font-bold uppercase tracking-[0.12em] text-slate">Optional</span>}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveHelpQuestion(question)}
                            className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-white text-sm font-black text-slate transition hover:border-fitgreen hover:text-fitgreen"
                            aria-label={`Help for question ${questionNumbers[question.id]}`}
                          >
                            ?
                          </button>
                        </div>
                        {question.helperText && <p className="mt-2 text-xs leading-5 text-slate">{question.helperText}</p>}
                        {question.type === "systems-map" ? (
                          <SystemsMappingInput
                            value={isSystemMappingResponse(responses["core-systems"]) ? responses["core-systems"] : {}}
                            missing={missing}
                            fieldStateClass={fieldStateClass}
                            onToolToggle={toggleSystemTool}
                            onOtherToolChange={setSystemOtherTool}
                            onIntegrationChange={(value) => setSystemMapping({ integration: value })}
                            onReportConfidenceChange={(value) => setSystemMapping({ reportConfidence: value })}
                          />
                        ) : question.type === "text" ? (
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
                                {question.allowOther && Array.isArray(responses[question.id]) && (responses[question.id] as string[]).includes("Other") && (
                                  <input
                                    value={(responses[`${question.id}__other`] as string) || ""}
                                    onChange={(event) => setResponses({ ...responses, [`${question.id}__other`]: event.target.value })}
                                    placeholder="Please name the workflow."
                                    className={`mt-3 min-h-11 w-full rounded border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${fieldStateClass}`}
                                  />
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

            {activeHelpQuestion && (
              <QuestionHelpModal question={activeHelpQuestion} onClose={() => setActiveHelpQuestion(null)} />
            )}
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
            analysisJob={analysisJobStatus}
            onRetryAnalysis={retryAnalysis}
          />
        )}
      </div>
    </main>
  );
}

function SystemsMappingInput({
  value,
  missing,
  fieldStateClass,
  onToolToggle,
  onOtherToolChange,
  onIntegrationChange,
  onReportConfidenceChange
}: {
  value: SystemMappingResponse;
  missing: boolean;
  fieldStateClass: string;
  onToolToggle: (category: SystemCategory, value: string) => void;
  onOtherToolChange: (category: SystemCategory, value: string) => void;
  onIntegrationChange: (value: string) => void;
  onReportConfidenceChange: (value: string) => void;
}) {
  const topRow = systemCategories.slice(0, 2);
  const secondRow = systemCategories.slice(2);

  return (
    <div className="mt-3 grid gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {topRow.map((category) => (
          <SystemCategoryPicker
            key={category.id}
            category={category}
            value={value}
            missing={missing}
            fieldStateClass={fieldStateClass}
            onToolToggle={onToolToggle}
            onOtherToolChange={onOtherToolChange}
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {secondRow.map((category) => (
          <SystemCategoryPicker
            key={category.id}
            category={category}
            value={value}
            missing={missing}
            fieldStateClass={fieldStateClass}
            onToolToggle={onToolToggle}
            onOtherToolChange={onOtherToolChange}
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">Do these systems share data automatically, manually, or not at all?</span>
          <select value={value.integration || ""} onChange={(event) => onIntegrationChange(event.target.value)} className={`min-h-11 rounded border bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-4 ${fieldStateClass}`}>
            <option value="">Select a response</option>
            {integrationOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate">How confident are you that leadership can trust reports generated from these systems?</span>
          <select value={value.reportConfidence || ""} onChange={(event) => onReportConfidenceChange(event.target.value)} className={`min-h-11 rounded border bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-4 ${fieldStateClass}`}>
            <option value="">Select a response</option>
            {reportingConfidenceOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function SystemCategoryPicker({
  category,
  value,
  missing,
  fieldStateClass,
  onToolToggle,
  onOtherToolChange
}: {
  category: (typeof systemCategories)[number];
  value: SystemMappingResponse;
  missing: boolean;
  fieldStateClass: string;
  onToolToggle: (category: SystemCategory, value: string) => void;
  onOtherToolChange: (category: SystemCategory, value: string) => void;
}) {
  const selected = selectedSystemTools(value, category.id);

  return (
    <div className={`rounded border bg-white p-3 ${missing && !selected.length ? "border-red-300" : "border-line"}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{category.label}</p>
      <div className="mt-2 grid gap-2">
        {category.options.map((option) => (
          <label key={option} className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold text-ink hover:bg-mist">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToolToggle(category.id, option)}
              className="size-4 accent-fitgreen"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {selected.includes("Other") && (
        <input
          value={value.otherTools?.[category.id] || ""}
          onChange={(event) => onOtherToolChange(category.id, event.target.value)}
          placeholder="Please name the system."
          className={`mt-2 min-h-10 w-full rounded border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${fieldStateClass}`}
        />
      )}
      {missing && !selected.length && <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-red-700">Required</p>}
    </div>
  );
}

function QuestionHelpModal({ question, onClose }: { question: Question; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 print:hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Question help</p>
            <h3 className="mt-1 text-lg font-bold">{question.prompt}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded border border-line text-sm font-bold hover:border-fitgreen">
            X
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate">{question.helpText || defaultHelpText(question)}</p>
        <button type="button" onClick={onClose} className="mt-4 min-h-10 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop">
          Got it
        </button>
      </div>
    </div>
  );
}

function defaultHelpText(question: Question) {
  if (question.type === "systems-map") {
    return "Choose the tools your team actually uses, then describe how data moves between them. Think about whether leaders can trust reports without manual cleanup or reconciliation.";
  }
  if (question.type === "multi") {
    return "Select every option that creates real friction for your team. Focus on recurring work that slows people down, creates rework, or makes reporting and handoffs harder.";
  }
  if (question.type === "text") {
    return "Add context only when it explains something important about your operations. Specific examples are more useful than broad statements. Unsure, none, or not-applicable answers are ignored.";
  }
  return "Answer based on the typical experience across the organization, not the best or worst single example. Consider time, manual work, reliability, handoffs, and how easily leaders can make decisions from the information available.";
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

function readableStep(step: string) {
  const labels: Record<string, string> = {
    queued: "Queued. Your assessment has been saved and is waiting for analysis.",
    identifying_organization: "Identifying the organization and matching nonprofit records.",
    fetching_sources: "Fetching annual reports, Form 990 summaries, website content, and public records.",
    parsing_documents: "Parsing source documents and preserving raw evidence.",
    extracting_financials: "Extracting financial metrics and source evidence.",
    calculating_trends: "Calculating revenue, expense, surplus, liquidity, and trend metrics.",
    scoring_viability: "Scoring nonprofit viability and operational strain indicators.",
    generating_report: "Generating the executive report narrative.",
    completed: "Analysis completed.",
    failed: "Analysis failed."
  };

  return labels[step] || "Working on the analysis.";
}

function FitProofLoadingScreen({ message, progressPercent }: { message: string; progressPercent: number }) {
  const clamped = Math.max(5, Math.min(96, progressPercent));

  return (
    <section className="overflow-hidden rounded border border-fitgreen/30 bg-white p-5 shadow-soft">
      <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
        <div className="grid place-items-center rounded bg-panel p-5">
          <img src="/fitproof-logo-trimmed.png" alt="FitProof" className="h-16 w-auto object-contain" />
          <div className="mt-5 flex items-center gap-2" aria-hidden="true">
            {[0, 1, 2, 3].map((node) => (
              <span
                key={node}
                className="size-3 rounded-full bg-fitgreen"
                style={{ animation: "fitproofPulse 1.4s ease-in-out infinite", animationDelay: `${node * 0.18}s` }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">FitProof analysis</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight">Building your operational intelligence report</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate">
            FitProof is gathering public financial, workforce, website, and assessment signals to create a more complete view of organizational health.
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-fitgreen transition-all duration-700" style={{ width: `${clamped}%` }} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">{message}</p>
          <p className="mt-2 text-sm leading-6 text-slate">
            This may take a few moments. We are checking multiple sources so the report is more useful and evidence-based.
          </p>
        </div>
      </div>
      <style jsx>{`
        @keyframes fitproofPulse {
          0%, 100% { opacity: 0.28; transform: translateY(0) scale(0.82); }
          50% { opacity: 1; transform: translateY(-4px) scale(1); }
        }
      `}</style>
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
  reportError,
  analysisJob,
  onRetryAnalysis
}: {
  profile: Profile;
  responses: Responses;
  result: AssessmentResult;
  lead: Lead;
  leadSaved: boolean;
  generatedReport: GeneratedExecutiveReport | null;
  isGeneratingReport: boolean;
  reportError: string;
  analysisJob: AnalysisJobStatus | null;
  onRetryAnalysis: () => void;
}) {
  const recommendation = stageRecommendations[result.stage.number];
  const intelligence = generatedReport?.operationalIntelligence;
  const summary = generatedReport?.executiveSummary || generateExecutiveSummary(profile, result);
  const risks = generatedReport?.topRisks?.length ? generatedReport.topRisks : generateRisks(result);
  const actions = generatedReport?.recommendations?.length ? generatedReport.recommendations : recommendation.actions;
  const openConstraint = getOpenConstraint(responses);
  const date = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const reportId = `FP-OCA-${date.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
  const [pdfExportError, setPdfExportError] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    if (!isGeneratingReport) return;
    const interval = window.setInterval(() => {
      setLoadingMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 2400);
    return () => window.clearInterval(interval);
  }, [isGeneratingReport]);

  async function downloadPdfReport() {
    setPdfExportError("");
    const reportElement = document.getElementById("generated-report");
    if (!reportElement) {
      setPdfExportError("PDF export could not find the report content. Please use the Word download as a fallback.");
      return;
    }

    const organization = profile.organization || "Organization";
    const fileName = `${organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "fitproof"}-operational-capacity-report.pdf`;
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(organization)} Operational Capacity Report</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; color: #111111; background: #ffffff; }
            #generated-report { max-width: none !important; border: 0 !important; box-shadow: none !important; }
            button, .print\\:hidden { display: none !important; }
            .bg-fitgreen { background-color: #67a629 !important; }
            .text-fitgreen { color: #67a629 !important; }
            footer { margin-top: 24px; border-top: 1px solid #d8ddd3; padding-top: 10px; color: #596057; font-size: 11px; }
          </style>
        </head>
        <body>${reportElement.outerHTML}<footer>FitProof | ${escapeHtml(date)} | ${escapeHtml(reportId)}</footer></body>
      </html>
    `;

    try {
      const response = await fetch("/api/reports/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, fileName })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "PDF export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (error) {
      setPdfExportError(error instanceof Error ? error.message : "PDF export failed. Please use the Word download as a fallback.");
    }
  }

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
            .gauge-grid { display: table; width: 100%; border-spacing: 8px; margin-top: 10px; }
            .gauge-cell { display: table-cell; width: 33.33%; border: 1px solid #d8ddd3; padding: 10px; vertical-align: top; }
            .word-gauge-head { display: flex; justify-content: space-between; font-size: 12px; }
            .word-gauge-track { position: relative; height: 12px; margin-top: 8px; border-radius: 999px; background: linear-gradient(90deg, #d83131 0%, #f1c232 50%, #67a629 100%); }
            .word-gauge-needle { position: absolute; top: -4px; display: block; width: 2px; height: 20px; background: #111111; }
            .word-gauge-scale { display: flex; justify-content: space-between; margin-top: 4px; color: #4b5563; font-size: 10px; }
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

          ${
            intelligence
              ? `
                <h2>Executive Gauges</h2>
                <div class="gauge-grid">
                  <div class="gauge-cell">${wordGaugeHtml("Operational Strain", intelligence.executiveSnapshot.operationalStrainScore)}</div>
                  <div class="gauge-cell">${wordGaugeHtml("Growth Readiness", intelligence.executiveSnapshot.growthReadinessScore)}</div>
                  <div class="gauge-cell">${wordGaugeHtml("Organizational Health", intelligence.executiveSnapshot.organizationalHealthScore)}</div>
                </div>
                <h2>Executive Summary</h2>${intelligence.executiveSummaryParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
                <h2>Score Profile</h2>
                <p><strong>Operational Strain:</strong> ${escapeHtml(scoreImpactText("strain", intelligence.executiveSnapshot.operationalStrainScore))}</p>
                <p><strong>Growth Readiness:</strong> ${escapeHtml(scoreImpactText("growth", intelligence.executiveSnapshot.growthReadinessScore))}</p>
                <p><strong>Organizational Health:</strong> ${escapeHtml(scoreImpactText("health", intelligence.executiveSnapshot.organizationalHealthScore))}</p>
                <h2>Current Spiral Stage</h2>
                <p><strong>${escapeHtml(intelligence.operationalStrainSpiral.currentStage)}:</strong> ${escapeHtml(intelligence.operationalStrainSpiral.stageDescription)}</p>
                <p><strong>Why classified here:</strong> ${escapeHtml(intelligence.operationalStrainSpiral.primaryStrainDrivers.slice(0, 3).join(" "))}</p>
                <p><strong>If unaddressed:</strong> ${escapeHtml(intelligence.operationalStrainSpiral.likelyFutureRisks.slice(0, 2).join(" "))}</p>
                <h2>Key Findings</h2><ul>${listItems(intelligence.keyFindings)}</ul>
                <h2>Benchmark Highlights</h2>
                <table><thead><tr><th>Metric</th><th>Organization</th><th>Peer Median</th><th>Percentile</th></tr></thead><tbody>${intelligence.benchmarkHighlights.map((item) => `<tr><td>${escapeHtml(item.metric)}</td><td>${escapeHtml(item.organizationDisplay)}</td><td>${escapeHtml(item.peerMedianDisplay)}</td><td>${escapeHtml(item.percentile === null ? "Unavailable" : `${item.percentile}th`)}</td></tr>`).join("")}</tbody></table>
                <h2>Executive KPIs</h2>
                ${intelligence.executiveKpis.map((group) => `<h3>${escapeHtml(group.title)}</h3><table><thead><tr><th>KPI</th><th>Value</th><th>Source</th></tr></thead><tbody>${group.items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.source)}</td></tr>`).join("")}</tbody></table>`).join("")}
                <h2>Primary Operational Risks</h2><ul>${listItems(intelligence.primaryOperationalRisks)}</ul>
                <h2>Growth Constraints</h2><ul>${listItems(intelligence.growthConstraints)}</ul>
                <h2>Recommended Priorities</h2><ul>${listItems(intelligence.recommendedPriorities)}</ul>
                <h2>Website & Public Presence Assessment</h2><p>${escapeHtml(intelligence.websitePresenceAssessment.status)}</p>${intelligence.websitePresenceAssessment.score === null ? "" : `<p><strong>Website Sophistication Score:</strong> ${escapeHtml(intelligence.websitePresenceAssessment.score)}/100</p>`}<p>${escapeHtml(intelligence.websitePresenceAssessment.impact)}</p><ul>${listItems(intelligence.websitePresenceAssessment.recommendations)}</ul>
                <h2>Public Reporting Sophistication</h2><p>${escapeHtml(intelligence.annualReportInsight.status)}</p>${intelligence.annualReportInsight.score === null ? "" : `<p><strong>Public Reporting Sophistication Score:</strong> ${escapeHtml(intelligence.annualReportInsight.score)}/100</p>`}<ul>${listItems(intelligence.annualReportInsight.findings)}</ul>
                <h2>Supporting Source Appendix</h2>
                <table><thead><tr><th>Metric</th><th>Value</th><th>Source</th></tr></thead><tbody>${intelligence.supportingMetrics.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.source)}</td></tr>`).join("")}</tbody></table>
                ${intelligence.workforceExtractionDebug ? `<h2>Workforce Extraction Debug</h2><p>Careers page found: ${escapeHtml(intelligence.workforceExtractionDebug.careersPageFound || "None")}</p><p>ATS platform detected: ${escapeHtml(intelligence.workforceExtractionDebug.atsPlatformDetected || "None")}</p><p>Postings extracted: ${escapeHtml(intelligence.workforceExtractionDebug.postingsExtracted)}; after deduplication: ${escapeHtml(intelligence.workforceExtractionDebug.postingsAfterDeduplication)}</p><ul>${listItems(intelligence.workforceExtractionDebug.sourceUrlsCrawled)}</ul>` : ""}
                ${intelligence.dataQualityNotes.length ? `<h2>Data Quality Notes</h2><ul>${listItems(intelligence.dataQualityNotes)}</ul>` : ""}
              `
              : `<h2>Executive Summary</h2><p>${escapeHtml(summary)}</p><h2>Score Profile</h2><p><span class="score">Operational strain: ${escapeHtml(result.riskScore)}/100</span><span class="score">Stage ${escapeHtml(result.stage.number)}: ${escapeHtml(result.stage.name)}</span></p>`
          }

          ${!intelligence && generatedReport?.organizationSnapshot ? `<h2>Organization Snapshot</h2><p>${escapeHtml(generatedReport.organizationSnapshot)}</p>` : ""}
          ${!intelligence && generatedReport?.missionImplications ? `<h2>Mission Implications</h2><p>${escapeHtml(generatedReport.missionImplications)}</p>` : ""}
          ${!intelligence && generatedReport?.strainDiagnosis ? `<h2>Operational Strain Diagnosis</h2><p>${escapeHtml(generatedReport.strainDiagnosis)}</p>` : ""}
          ${!intelligence && generatedReport?.financialAnalysis ? `<h2>Financial Trend and Viability Context</h2><p>${escapeHtml(generatedReport.financialAnalysis)}</p>` : ""}
          ${!intelligence && generatedReport?.staffingCapacityAnalysis ? `<h2>Workforce Capacity Context</h2><p>${escapeHtml(generatedReport.staffingCapacityAnalysis)}</p>` : ""}
          ${!intelligence && generatedReport?.strategicSignals ? `<h2>Strategy and Roadblock Context</h2><p>${escapeHtml(generatedReport.strategicSignals)}</p>` : ""}

          <h2>Section Scorecard</h2>
          <table>
            <thead><tr><th>Section</th><th>Strain</th><th>Responses</th></tr></thead>
            <tbody>${sectionRows}</tbody>
          </table>

          ${!intelligence ? `<h2>Primary Strain Drivers</h2>` : ""}
          ${
            !intelligence && generatedReport?.primaryStrainDrivers?.length
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
              : !intelligence ? `<ul>${listItems(risks)}</ul>` : ""
          }

          ${!intelligence ? `<h2>Top Operational Strain Risks</h2><ul>${listItems(risks)}</ul>` : ""}

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
        <div className="flex flex-col gap-2 print:hidden">
          <button type="button" onClick={downloadPdfReport} className="min-h-11 rounded bg-fitgreen px-4 text-sm font-bold text-blacktop transition hover:bg-blacktop hover:text-fitgreen">
            Download PDF
          </button>
          <button type="button" onClick={downloadWordReport} className="min-h-11 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop">
            Download Word Document
          </button>
        </div>
      </div>

      {pdfExportError && (
        <section className="rounded border border-red-200 bg-red-50 p-4 print:hidden">
          <h3 className="text-lg font-bold text-red-800">PDF Export Note</h3>
          <p className="mt-2 text-sm leading-6 text-red-700">{pdfExportError}</p>
        </section>
      )}

      {isGeneratingReport && <FitProofLoadingScreen message={loadingMessages[loadingMessageIndex]} progressPercent={analysisJob?.progressPercent || 8} />}

      {(reportError || generatedReport?.fallbackReason) && (
        <section className="rounded border border-line bg-panel p-4">
          <h3 className="text-lg font-bold">Report Generation Note</h3>
          <p className="mt-2 text-sm leading-6 text-slate">{reportError || generatedReport?.fallbackReason}</p>
          {analysisJob?.status === "failed" && (
            <button type="button" onClick={onRetryAnalysis} className="mt-3 min-h-10 rounded bg-blacktop px-4 text-sm font-bold text-fitgreen transition hover:bg-fitgreen hover:text-blacktop">
              Retry analysis
            </button>
          )}
        </section>
      )}

      {intelligence ? (
        <OperationalIntelligenceView intelligence={intelligence} sources={generatedReport?.sources || []} />
      ) : (
        <>
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

      {(generatedReport?.financialAnalysis || generatedReport?.staffingCapacityAnalysis || generatedReport?.strategicSignals) && (
        <section className="grid gap-4 md:grid-cols-3">
          {generatedReport.financialAnalysis && (
            <div className="rounded border border-line p-4">
              <h3 className="text-lg font-bold">Financial Trend and Viability Context</h3>
              <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.financialAnalysis}</p>
            </div>
          )}
          {generatedReport.staffingCapacityAnalysis && (
            <div className="rounded border border-line p-4">
              <h3 className="text-lg font-bold">Workforce Capacity Context</h3>
              <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.staffingCapacityAnalysis}</p>
            </div>
          )}
          {generatedReport.strategicSignals && (
            <div className="rounded border border-line p-4">
              <h3 className="text-lg font-bold">Strategy and Roadblock Context</h3>
              <p className="mt-2 text-sm leading-6 text-slate">{generatedReport.strategicSignals}</p>
            </div>
          )}
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
        </>
      )}

      {generatedReport && !intelligence && (
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

function OperationalIntelligenceView({
  intelligence,
  sources
}: {
  intelligence: NonNullable<GeneratedExecutiveReport["operationalIntelligence"]>;
  sources: { title: string; url: string }[];
}) {
  const snapshot = intelligence.executiveSnapshot;
  const categoryScores = Object.entries(intelligence.organizationalHealthScore.categoryScores);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3">
        <ExecutiveGaugeCard label="Operational Strain" value={snapshot.operationalStrainScore} mode="strain" detail={snapshot.operationalStrainSpiralStage} />
        <ExecutiveGaugeCard label="Growth Readiness" value={snapshot.growthReadinessScore} mode="health" detail={intelligence.growthReadinessScore.classification} />
        <ExecutiveGaugeCard label="Organizational Health" value={snapshot.organizationalHealthScore} mode="health" detail={`${intelligence.operationalStrainSpiral.stageConfidence}% stage confidence`} />
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h3 className="text-lg font-bold">Executive Summary</h3>
        <div className="mt-3 grid gap-3">
          {intelligence.executiveSummaryParagraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-slate">{paragraph}</p>
          ))}
        </div>
        <div className="mt-4 grid gap-3 border-t border-line pt-4 text-sm md:grid-cols-2">
          <p><strong>Financial stability:</strong> {labelForBand(snapshot.financialStabilityIndicator)}</p>
          <p><strong>Workforce capacity:</strong> {labelForBand(snapshot.workforceCapacityIndicator)}</p>
          <p><strong>Benchmark percentile:</strong> {snapshot.benchmarkPercentile === null ? "Unavailable" : `${snapshot.benchmarkPercentile}th percentile`}</p>
          <p><strong>Growth classification:</strong> {intelligence.growthReadinessScore.classification}</p>
          <p className="md:col-span-2"><strong>Spiral stage:</strong> {intelligence.operationalStrainSpiral.stageDescription}</p>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h3 className="text-lg font-bold">Score Profile</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ImpactCard title="Operational Strain" value={snapshot.operationalStrainScore} text={scoreImpactText("strain", snapshot.operationalStrainScore)} />
          <ImpactCard title="Growth Readiness" value={snapshot.growthReadinessScore} text={scoreImpactText("growth", snapshot.growthReadinessScore)} />
          <ImpactCard title="Organizational Health" value={snapshot.organizationalHealthScore} text={scoreImpactText("health", snapshot.organizationalHealthScore)} />
        </div>
      </section>

      <section className="rounded border border-fitgreen/40 bg-fitgreen/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fitgreen">Current Spiral Stage</p>
        <h3 className="mt-2 text-2xl font-bold">{intelligence.operationalStrainSpiral.currentStage}</h3>
        <p className="mt-2 text-sm leading-6 text-slate">{intelligence.operationalStrainSpiral.stageDescription}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-bold">Why classified here</p>
            <p className="mt-1 text-sm leading-6 text-slate">{intelligence.operationalStrainSpiral.primaryStrainDrivers.slice(0, 2).join(" ")}</p>
          </div>
          <div>
            <p className="text-sm font-bold">Top evidence signals</p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-slate">
              {intelligence.operationalStrainSpiral.primaryStrainDrivers.slice(0, 3).map((driver) => <li key={driver}>{driver}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">If unaddressed</p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-slate">
              {intelligence.operationalStrainSpiral.likelyFutureRisks.slice(0, 3).map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <RevenueExpenseTrendChart points={intelligence.financialTrend} />
        <LiquidityBenchmarkChart benchmarks={intelligence.benchmarkHighlights} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <PeerBenchmarkRadarChart benchmarks={intelligence.benchmarkHighlights} />
        <WorkforceCapacityKpis groups={intelligence.executiveKpis} />
      </section>

      <section className="rounded border border-line bg-mist p-4">
        <h3 className="text-lg font-bold">Key Findings</h3>
        <div className="mt-3 grid gap-2">
          {intelligence.keyFindings.map((finding) => (
            <p key={finding} className="rounded border border-fitgreen/30 bg-white px-3 py-2 text-sm font-semibold leading-6 text-ink">{finding}</p>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_1.15fr]">
        <div className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Organizational Health Score</h3>
          <div className="mt-3 grid gap-3">
            {categoryScores.map(([category, score]) => (
              <div key={category} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-sm">
                <span className="font-semibold text-slate">{category}</span>
                <Meter value={score} />
                <span className="text-right font-bold tabular-nums">{score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-line p-4">
          <h3 className="text-lg font-bold">Benchmark Highlights</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.1em] text-slate">
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Organization</th>
                  <th className="py-2 pr-3">Peer median</th>
                  <th className="py-2 pr-3">Percentile</th>
                </tr>
              </thead>
              <tbody>
                {intelligence.benchmarkHighlights.length ? (
                  intelligence.benchmarkHighlights.map((item) => (
                    <tr key={item.metric} className="border-b border-line/70">
                      <td className="py-2 pr-3 font-semibold">{item.metric}</td>
                      <td className="py-2 pr-3">{item.organizationDisplay}</td>
                      <td className="py-2 pr-3">{item.peerMedianDisplay}</td>
                      <td className="py-2 pr-3">{item.percentile === null ? "Unavailable" : `${item.percentile}th`}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="py-2 text-slate" colSpan={4}>Benchmark comparisons were unavailable because source metrics were not found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ListPanel title="Primary Operational Risks" items={intelligence.primaryOperationalRisks} />
        <ListPanel title="Address Growth Constraints" items={intelligence.growthConstraints} />
        <ListPanel title="Recommended Priorities" items={intelligence.recommendedPriorities} />
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h3 className="text-lg font-bold">Website & Public Presence Assessment</h3>
        <p className="mt-2 text-sm leading-6 text-slate">{intelligence.websitePresenceAssessment.status}</p>
        {intelligence.websitePresenceAssessment.score !== null && (
          <p className="mt-2 text-sm font-bold">Website Sophistication Score: {intelligence.websitePresenceAssessment.score}/100</p>
        )}
        <p className="mt-2 text-sm leading-6 text-slate">{intelligence.websitePresenceAssessment.impact}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold">Strongest website signals</p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-slate">
              {intelligence.websitePresenceAssessment.strongestSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Weakest website signals</p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-slate">
              {intelligence.websitePresenceAssessment.weakestSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </div>
        </div>
        {intelligence.websitePresenceAssessment.recommendations.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-bold">Website improvement recommendations</p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-slate">
              {intelligence.websitePresenceAssessment.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h3 className="text-lg font-bold">Public Reporting Sophistication</h3>
        <p className="mt-2 text-sm leading-6 text-slate">{intelligence.annualReportInsight.status}</p>
        {intelligence.annualReportInsight.score !== null && (
          <p className="mt-2 text-sm font-bold">Public Reporting Sophistication Score: {intelligence.annualReportInsight.score}/100</p>
        )}
        {intelligence.annualReportInsight.findings.length > 0 && (
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
            {intelligence.annualReportInsight.findings.map((finding) => <li key={finding}>{finding}</li>)}
          </ul>
        )}
        {intelligence.annualReportInsight.sourceUrl && <p className="mt-3 text-xs text-slate">Source: {intelligence.annualReportInsight.sourceUrl}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {intelligence.executiveKpis.map((group) => (
          <details key={group.title} className="rounded border border-line bg-white p-4">
            <summary className="cursor-pointer text-lg font-bold">{group.title}</summary>
            <div className="mt-3 grid gap-2">
              {group.items.map((item) => (
                <div key={item.label} className="grid gap-1 rounded border border-line bg-panel p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs leading-5 text-slate">{item.source}</p>
                  </div>
                  <p className={`text-sm font-bold ${indicatorTextClass(item.indicator)}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>

      <details className="rounded border border-line bg-panel p-4">
        <summary className="cursor-pointer text-lg font-bold">Supporting Source Appendix</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.1em] text-slate">
                <th className="py-2 pr-3">Metric</th>
                <th className="py-2 pr-3">Value</th>
                <th className="py-2 pr-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {intelligence.supportingMetrics.map((item) => (
                <tr key={item.label} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-semibold">{item.label}</td>
                  <td className="py-2 pr-3">{item.value}</td>
                  <td className="py-2 pr-3 text-slate">{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {intelligence.workforceExtractionDebug && (
        <details className="rounded border border-line bg-white p-4">
          <summary className="cursor-pointer text-lg font-bold">Workforce Extraction Debug</summary>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate">
            <p><strong>Careers page found:</strong> {intelligence.workforceExtractionDebug.careersPageFound || "None"}</p>
            <p><strong>ATS platform detected:</strong> {intelligence.workforceExtractionDebug.atsPlatformDetected || "None"}</p>
            <p><strong>Pages crawled:</strong> {intelligence.workforceExtractionDebug.pagesCrawled}</p>
            <p><strong>Postings extracted:</strong> {intelligence.workforceExtractionDebug.postingsExtracted}</p>
            <p><strong>Postings after deduplication:</strong> {intelligence.workforceExtractionDebug.postingsAfterDeduplication}</p>
            <p><strong>JavaScript rendering required:</strong> {intelligence.workforceExtractionDebug.javascriptRenderingRequired ? "Possibly" : "No clear signal"}</p>
            {intelligence.workforceExtractionDebug.extractionErrors.length > 0 && (
              <p><strong>Extraction errors:</strong> {intelligence.workforceExtractionDebug.extractionErrors.join("; ")}</p>
            )}
            <p><strong>Source URLs crawled:</strong></p>
            <ul className="grid gap-1">
              {intelligence.workforceExtractionDebug.sourceUrlsCrawled.map((url) => <li key={url}>{url}</li>)}
            </ul>
          </div>
        </details>
      )}

      {intelligence.dataQualityNotes.length > 0 && (
        <details className="rounded border border-line bg-white p-4">
          <summary className="cursor-pointer text-lg font-bold">Data Quality Notes</summary>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
            {intelligence.dataQualityNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </details>
      )}

      <details className="rounded border border-line bg-white p-4">
        <summary className="cursor-pointer text-lg font-bold">Sources Reviewed</summary>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
          {sources.length ? (
            sources.map((source) => <li key={source.url}>{source.title}: {source.url}</li>)
          ) : (
            <li>No public website sources were available.</li>
          )}
        </ul>
      </details>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-line p-4">
      <h3 className="text-lg font-bold">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>No priority items available.</li>}
      </ul>
    </div>
  );
}

function ImpactCard({ title, value, text }: { title: string; value: number; text: string }) {
  return (
    <div className="rounded border border-line bg-panel p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}<span className="text-sm text-slate">/100</span></p>
      <p className="mt-2 text-sm leading-6 text-slate">{text}</p>
    </div>
  );
}

function scoreImpactText(kind: "strain" | "growth" | "health", score: number) {
  if (kind === "strain") {
    if (score >= 70) return "This level of strain can materially consume leadership bandwidth, slow execution, and create service delivery or scalability risk.";
    if (score >= 45) return "This strain level suggests leadership and teams are absorbing meaningful execution pressure that may limit scalability if demand increases.";
    return "This strain level suggests operating pressure is manageable, though leaders should still protect execution capacity as complexity grows.";
  }

  if (kind === "growth") {
    if (score >= 75) return "The organization appears positioned to grow with targeted operational controls and limited added drag.";
    if (score >= 55) return "The organization has a viable growth base, but scaling may increase operational drag unless process, staffing, or systems constraints are addressed.";
    return "Growth should be paced carefully until the operating model can absorb additional complexity without creating avoidable drag.";
  }

  if (score >= 75) return "Overall resilience and operating stability appear strong enough to sustain performance with focused improvement in watch areas.";
  if (score >= 55) return "The organization shows a mixed health profile: stable enough to improve, but constrained enough that execution reliability may vary by function.";
  return "Organizational resilience appears constrained, with stability and sustained performance dependent on near-term operating improvements.";
}

function labelForBand(value: string) {
  if (value === "strong") return "Strong";
  if (value === "watch") return "Watch area";
  if (value === "constrained") return "Constrained";
  if (value === "critical") return "Critical";
  return "Unavailable";
}

function ExecutiveGaugeCard({ label, value, mode, detail }: { label: string; value: number | null | undefined; mode: "strain" | "health"; detail: string }) {
  const numericValue = Number(value);
  const hasValue = value !== null && value !== undefined && !Number.isNaN(numericValue);
  const clamped = hasValue ? Math.max(0, Math.min(100, numericValue)) : null;
  const angle = scoreToGaugeRotation(value);
  const gradientId = `gauge-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="rounded border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-charcoal">{hasValue ? Math.round(clamped || 0) : "N/A"}{hasValue && <span className="text-base text-slate">/100</span>}</p>
        </div>
        <p className="max-w-40 text-right text-xs font-bold leading-5 text-fitgreen">{detail}</p>
      </div>
      <div className="mx-auto mt-3 w-full max-w-[260px]">
        <svg viewBox="0 0 240 132" role="img" aria-label={hasValue ? `${label} ${clamped} out of 100` : `${label} not available`} className={`h-auto w-full ${hasValue ? "" : "opacity-50"}`}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {mode === "strain" ? (
                <>
                  <stop offset="0%" stopColor="#67a629" />
                  <stop offset="52%" stopColor="#f1c232" />
                  <stop offset="100%" stopColor="#c94b4b" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#c94b4b" />
                  <stop offset="52%" stopColor="#f1c232" />
                  <stop offset="100%" stopColor="#67a629" />
                </>
              )}
            </linearGradient>
          </defs>
          <path d="M28 112 A92 92 0 0 1 212 112" fill="none" stroke={`url(#${gradientId})`} strokeWidth="18" strokeLinecap="round" />
          {angle !== null && <line x1="120" y1="112" x2="120" y2="40" stroke="#111" strokeWidth="5" strokeLinecap="round" transform={`rotate(${angle} 120 112)`} />}
          <circle cx="120" cy="112" r="7" fill={angle === null ? "#9ca3af" : "#111"} />
          <text x="28" y="128" fontSize="11" fontWeight="700" fill="#596057">0</text>
          <text x="113" y="28" fontSize="11" fontWeight="700" fill="#596057">50</text>
          <text x="202" y="128" fontSize="11" fontWeight="700" fill="#596057">100</text>
        </svg>
      </div>
    </div>
  );
}

function RevenueExpenseTrendChart({ points }: { points: NonNullable<GeneratedExecutiveReport["operationalIntelligence"]>["financialTrend"] }) {
  const values = points.flatMap((point) => [point.revenue, point.expenses]).filter((value): value is number => value !== null);
  const max = Math.max(...values, 1);
  const chartPoints = points.length ? points : [];
  const coords = (key: "revenue" | "expenses") =>
    chartPoints
      .map((point, index) => {
        const x = chartPoints.length === 1 ? 40 : 32 + (index * 236) / (chartPoints.length - 1);
        const y = 150 - (((point[key] || 0) / max) * 110);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="rounded border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">5-Year Revenue vs Expense Trend</h3>
        <div className="flex gap-3 text-xs font-bold text-slate">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-fitgreen" />Revenue</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-red-500" />Expense</span>
        </div>
      </div>
      {chartPoints.length ? (
        <svg viewBox="0 0 300 180" className="mt-3 h-auto w-full" role="img" aria-label="Revenue and expense trend chart">
          {[40, 80, 120, 160].map((y) => <line key={y} x1="28" y1={y} x2="280" y2={y} stroke="#d8ddd3" strokeWidth="1" />)}
          <polyline points={coords("revenue")} fill="none" stroke="#67a629" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={coords("expenses")} fill="none" stroke="#c94b4b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {chartPoints.map((point, index) => {
            const x = chartPoints.length === 1 ? 40 : 32 + (index * 236) / (chartPoints.length - 1);
            return <text key={point.fiscalYear} x={x - 10} y="172" fontSize="10" fontWeight="700" fill="#596057">{point.fiscalYear}</text>;
          })}
        </svg>
      ) : (
        <p className="mt-3 text-sm text-slate">Revenue and expense trend data was unavailable.</p>
      )}
    </div>
  );
}

function LiquidityBenchmarkChart({ benchmarks }: { benchmarks: NonNullable<GeneratedExecutiveReport["operationalIntelligence"]>["benchmarkHighlights"] }) {
  const liquidity = benchmarks.find((item) => /cash|liquidity|current ratio/i.test(item.metric));
  const percentile = liquidity?.percentile ?? null;
  if (!liquidity) return null;

  return (
    <div className="rounded border border-line p-4">
      <h3 className="text-lg font-bold">Liquidity Benchmark</h3>
      <p className="mt-2 text-sm leading-6 text-slate">{liquidity ? `${liquidity.metric}: ${liquidity.organizationDisplay} vs peer median ${liquidity.peerMedianDisplay}.` : "Liquidity benchmark data was unavailable."}</p>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-bold uppercase tracking-[0.1em] text-slate">
          <span>Bottom</span><span>Median</span><span>Top</span>
        </div>
        <div className="relative mt-2 h-4 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-fitgreen">
          <span className="absolute top-1/2 h-7 w-1 -translate-y-1/2 rounded bg-blacktop" style={{ left: `${Math.max(0, Math.min(100, percentile ?? 50))}%` }} />
        </div>
        <p className="mt-3 text-sm font-bold">{percentile === null ? "Percentile unavailable" : `${percentile}th percentile`}</p>
      </div>
    </div>
  );
}

function PeerBenchmarkRadarChart({ benchmarks }: { benchmarks: NonNullable<GeneratedExecutiveReport["operationalIntelligence"]>["benchmarkHighlights"] }) {
  const items = benchmarks.slice(0, 5);
  const center = 105;
  const radius = 72;
  const axes = items.map((item, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(items.length, 1) - Math.PI / 2;
    return {
      item,
      endX: center + Math.cos(angle) * radius,
      endY: center + Math.sin(angle) * radius,
      valueX: center + Math.cos(angle) * radius * ((item.percentile || 0) / 100),
      valueY: center + Math.sin(angle) * radius * ((item.percentile || 0) / 100)
    };
  });
  const polygon = axes.map((axis) => `${axis.valueX},${axis.valueY}`).join(" ");

  return (
    <div className="rounded border border-line p-4">
      <h3 className="text-lg font-bold">Peer Benchmark Radar</h3>
      {items.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
          <svg viewBox="0 0 210 210" className="h-auto w-full max-w-[230px]" role="img" aria-label="Peer benchmark radar chart">
            {[0.33, 0.66, 1].map((scale) => <circle key={scale} cx={center} cy={center} r={radius * scale} fill="none" stroke="#d8ddd3" />)}
            {axes.map((axis) => <line key={axis.item.metric} x1={center} y1={center} x2={axis.endX} y2={axis.endY} stroke="#d8ddd3" />)}
            <polygon points={polygon} fill="#67a62955" stroke="#67a629" strokeWidth="3" />
          </svg>
          <ul className="grid gap-2 text-sm text-slate">
            {items.map((item) => (
              <li key={item.metric}><strong className="text-ink">{item.metric}:</strong> {item.percentile === null ? "Unavailable" : `${item.percentile}th percentile`} ({item.quartile})</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate">Peer benchmark radar was unavailable because benchmark metrics were not found.</p>
      )}
    </div>
  );
}

function WorkforceCapacityKpis({ groups }: { groups: NonNullable<GeneratedExecutiveReport["operationalIntelligence"]>["executiveKpis"] }) {
  const operational = groups.find((group) => group.title === "Operational KPIs");
  const items = (operational?.items || []).filter((item) => /open role|requisition|staffing/i.test(item.label));

  return (
    <div className="rounded border border-line p-4">
      <h3 className="text-lg font-bold">Workforce Capacity KPIs</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="rounded border border-line bg-panel p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate">{item.label}</p>
              <p className={`mt-2 text-xl font-bold ${indicatorTextClass(item.indicator)}`}>{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-slate">{item.source}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate">Workforce KPI data was unavailable.</p>
        )}
      </div>
    </div>
  );
}

function indicatorTextClass(indicator: string) {
  if (indicator === "strong") return "text-fitgreen";
  if (indicator === "watch") return "text-yellow-700";
  if (indicator === "constrained") return "text-orange-700";
  if (indicator === "critical") return "text-red-700";
  return "text-slate";
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

      <div className="mx-auto mt-3 w-1/2 min-w-[210px] max-w-[300px]">
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
          <text x="30" y="153" fontSize="10" fontWeight="700" fill="#4b5563">0 low strain</text>
          <text x="270" y="153" textAnchor="end" fontSize="10" fontWeight="700" fill="#4b5563">100 severe strain</text>
        </svg>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate">
        The pointer shows where the organization sits on the operational strain scale based on the completed assessment.
      </p>
    </div>
  );
}
