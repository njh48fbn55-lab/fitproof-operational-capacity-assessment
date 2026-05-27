import { AssessmentResult, DomainId } from "@/lib/operational-capacity";
import { EnhancedAnalysisResult, FinancialMetricName, FinancialYear } from "@/lib/nonprofit-viability/types";

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function healthFromRisk(risk: number) {
  return clampScore(100 - risk);
}

export function domainHealth(result: AssessmentResult, domainId: DomainId) {
  const domain = result.domainScores.find((item) => item.id === domainId);
  return domain ? healthFromRisk(domain.risk) : 50;
}

export function latestFinancialYear(enhancedAnalysis?: EnhancedAnalysisResult | null) {
  return enhancedAnalysis?.financialYears?.[0] || null;
}

export function metric(year: FinancialYear | null, name: FinancialMetricName) {
  return year?.metrics.find((item) => item.name === name)?.value ?? null;
}

export function averageMetric(years: FinancialYear[] | undefined, name: FinancialMetricName) {
  const values = (years || []).map((year) => metric(year, name)).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function scoreFromThresholds(value: number | null, thresholds: Array<{ min: number; score: number }>, fallback = 50) {
  if (value === null || Number.isNaN(value)) return fallback;
  const match = thresholds.find((threshold) => value >= threshold.min);
  return match ? match.score : thresholds[thresholds.length - 1]?.score ?? fallback;
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

export function formatNumber(value: number | null, decimals = 1) {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function formatMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function band(score: number) {
  if (score >= 80) return "strong";
  if (score >= 65) return "watch";
  if (score >= 45) return "constrained";
  return "critical";
}
