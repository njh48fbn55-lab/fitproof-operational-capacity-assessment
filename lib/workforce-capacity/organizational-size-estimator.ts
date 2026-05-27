import { EnhancedAnalysisResult } from "@/lib/nonprofit-viability/types";
import { WorkforceSizeEstimate } from "./types";

export function organizationalSizeEstimator(enhancedAnalysis?: EnhancedAnalysisResult | null): WorkforceSizeEstimate {
  if (!enhancedAnalysis) {
    return {
      estimatedEmployeeCount: null,
      confidence: "low",
      sources: [],
      method: "No enhanced public context was available.",
      notes: ["Workforce size could not be estimated from public sources."]
    };
  }

  const candidates: Array<{ count: number; source: string; confidence: WorkforceSizeEstimate["confidence"] }> = [];
  const addCandidates = (text: string | undefined, source: string, confidence: WorkforceSizeEstimate["confidence"]) => {
    for (const count of employeeCountsFromText(text || "")) {
      candidates.push({ count, source, confidence });
    }
  };

  enhancedAnalysis.sources.forEach((source) => {
    const text = `${source.title}. ${source.notes || ""}. ${source.textExcerpt || ""}`;
    const confidence = /990|form 990|employee count|w-2/i.test(text) ? "high" : source.confidence;
    addCandidates(text, source.title, confidence);
  });
  addCandidates(enhancedAnalysis.websiteAnalysis.programDescriptions.join(" "), "Website program descriptions", "medium");
  addCandidates(enhancedAnalysis.websiteAnalysis.operationalComplexitySignals.join(" "), "Website operational complexity signals", "medium");

  const usable = candidates.filter((candidate) => candidate.count >= 5 && candidate.count <= 100000);
  if (!usable.length) {
    return {
      estimatedEmployeeCount: null,
      confidence: "low",
      sources: [],
      method: "Reviewed website, public report excerpts, and available filing context.",
      notes: ["Employee count unavailable from reliable public sources. Open position ratio is therefore not calculated."]
    };
  }

  usable.sort((a, b) => confidenceWeight(b.confidence) - confidenceWeight(a.confidence) || b.count - a.count);
  const selected = usable[0];

  return {
    estimatedEmployeeCount: selected.count,
    confidence: selected.confidence,
    sources: [...new Set(usable.slice(0, 4).map((candidate) => `${candidate.source}: ${candidate.count.toLocaleString()} employees/staff reference`))],
    method: "Estimated from public Form 990/report/website staffing references when available.",
    notes: ["This is an estimate from public organizational sources, not a private LinkedIn scrape."]
  };
}

function employeeCountsFromText(text: string) {
  const counts: number[] = [];
  const patterns = [
    /\b(?:employs?|employed|workforce of|staff of|team of|more than|over|approximately|about)\s+(\d{1,3}(?:,\d{3})?|\d{2,6})\s+(?:full[-\s]?time\s+)?(?:employees|staff|team members|associates|people)\b/gi,
    /\b(\d{1,3}(?:,\d{3})?|\d{2,6})\s+(?:full[-\s]?time\s+)?(?:employees|staff|team members|associates)\b/gi,
    /\bform\s+990[^.]{0,80}(?:employees|employee count|w-2)[^.]{0,40}(\d{1,3}(?:,\d{3})?|\d{2,6})\b/gi
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]?.replace(/,/g, ""));
      if (Number.isFinite(value)) counts.push(value);
    }
  });

  return [...new Set(counts)];
}

function confidenceWeight(confidence: WorkforceSizeEstimate["confidence"]) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}
