import { CareersRole, StaffingMetrics, StaffingNarrative, StaffingRiskScore, WorkforceSizeEstimate } from "./types";

export function staffingNarrativeGenerator({
  roles,
  metrics,
  workforceSize,
  riskScore
}: {
  roles: CareersRole[];
  metrics: StaffingMetrics;
  workforceSize: WorkforceSizeEstimate;
  riskScore: StaffingRiskScore;
}): StaffingNarrative {
  const topDepartments = Object.entries(metrics.openPositionsByDepartment)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([department, count]) => `${department} (${count})`);

  return {
    staffingCapacitySummary:
      roles.length === 0
        ? "No public open roles were found in reviewed careers sources, so public hiring data does not show a clear staffing capacity signal."
        : `Reviewed public hiring sources show ${metrics.totalOpenPositions} open role${metrics.totalOpenPositions === 1 ? "" : "s"}${topDepartments.length ? `, concentrated in ${topDepartments.join(", ")}` : ""}. The staffing strain indicator is ${riskScore.level}.`,
    operationalStrainObservations: riskScore.indicators.map((indicator) => `${indicator}. This is a public hiring signal of possible operational strain, not proof of turnover or employee sentiment.`),
    likelyPressureAreas: pressureAreas(metrics, roles),
    hiringBottleneckAnalysis: hiringBottleneckAnalysis(metrics, workforceSize, riskScore),
    recommendations: recommendations(riskScore, metrics)
  };
}

function pressureAreas(metrics: StaffingMetrics, roles: CareersRole[]) {
  const areas = Object.entries(metrics.openPositionsByDepartment)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([department]) => `${department} capacity may need review because it appears in public open-role data.`);
  if (metrics.leadershipOpenings > 0) areas.push("Leadership capacity may need attention because at least one public senior-level opening was found.");
  if (!areas.length && roles.length === 0) areas.push("No specific public hiring pressure area was identified.");
  return areas;
}

function hiringBottleneckAnalysis(metrics: StaffingMetrics, workforceSize: WorkforceSizeEstimate, riskScore: StaffingRiskScore) {
  const age = metrics.averageRequisitionAgeDays === null ? "Public posting age was not consistently available." : `Average visible requisition age is approximately ${metrics.averageRequisitionAgeDays} days.`;
  const ratio = metrics.openRoleRatio === null ? "Open-role ratio could not be calculated because no reliable public employee-count estimate was available." : `Open-role ratio is approximately ${Math.round(metrics.openRoleRatio * 100)}% of estimated workforce size.`;
  return `${age} ${ratio} Overall, the hiring signal is ${riskScore.level}; extended vacancy duration may indicate recruiting challenges, but this should be validated with internal vacancy and time-to-fill data. ${workforceSize.notes.join(" ")}`;
}

function recommendations(riskScore: StaffingRiskScore, metrics: StaffingMetrics) {
  const base = [
    "Validate public hiring signals against internal vacancy, time-to-fill, and critical-role coverage data.",
    "Separate service-critical vacancies from growth, backfill, and administrative hiring so leadership can see true operating exposure.",
    "Review whether open roles are connected to bottlenecks reported in the operational assessment."
  ];

  if (riskScore.level === "elevated" || riskScore.level === "severe") {
    base.push("Create a 30-60 day staffing capacity triage focused on aged requisitions, senior openings, and departments with concentrated hiring.");
  }

  if (metrics.leadershipOpenings > 0) {
    base.push("Assess decision coverage and escalation paths while senior roles remain open.");
  }

  return base;
}
