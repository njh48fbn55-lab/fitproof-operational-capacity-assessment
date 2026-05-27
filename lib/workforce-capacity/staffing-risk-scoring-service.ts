import { CareersRole, StaffingMetrics, StaffingRiskScore } from "./types";

export function staffingRiskScoringService(metrics: StaffingMetrics, roles: CareersRole[]): StaffingRiskScore {
  let points = 0;
  const indicators: string[] = [];
  const evidence: string[] = [];

  if (metrics.openRoleRatio !== null) {
    if (metrics.openRoleRatio >= 0.12) {
      points += 35;
      indicators.push("High open-role ratio");
      evidence.push(`Open roles equal approximately ${Math.round(metrics.openRoleRatio * 100)}% of estimated workforce size.`);
    } else if (metrics.openRoleRatio >= 0.08) {
      points += 25;
      indicators.push("Elevated open-role ratio");
      evidence.push(`Open roles equal approximately ${Math.round(metrics.openRoleRatio * 100)}% of estimated workforce size.`);
    } else if (metrics.openRoleRatio >= 0.04) {
      points += 12;
      indicators.push("Moderate open-role ratio");
      evidence.push(`Open roles equal approximately ${Math.round(metrics.openRoleRatio * 100)}% of estimated workforce size.`);
    }
  }

  if ((metrics.percentOpenMoreThan90Days || 0) >= 0.25) {
    points += 25;
    indicators.push("Aging requisitions over 90 days");
    evidence.push(`${Math.round((metrics.percentOpenMoreThan90Days || 0) * 100)}% of dated public roles appear open more than 90 days.`);
  } else if ((metrics.percentOpenMoreThan60Days || 0) >= 0.35) {
    points += 18;
    indicators.push("Aging requisitions over 60 days");
    evidence.push(`${Math.round((metrics.percentOpenMoreThan60Days || 0) * 100)}% of dated public roles appear open more than 60 days.`);
  } else if ((metrics.percentOpenMoreThan30Days || 0) >= 0.5) {
    points += 10;
    indicators.push("Roles open more than 30 days");
    evidence.push(`${Math.round((metrics.percentOpenMoreThan30Days || 0) * 100)}% of dated public roles appear open more than 30 days.`);
  }

  if (metrics.leadershipOpenings >= 3) {
    points += 22;
    indicators.push("Multiple senior or executive openings");
    evidence.push(`${metrics.leadershipOpenings} public openings appear to be senior leadership roles.`);
  } else if (metrics.leadershipOpenings > 0) {
    points += 10;
    indicators.push("Senior or executive opening present");
    evidence.push(`${metrics.leadershipOpenings} public opening appears to be a senior leadership role.`);
  }

  const concentrated = concentratedDepartments(metrics);
  if (concentrated.length) {
    points += 12;
    indicators.push("Concentrated hiring in critical functions");
    evidence.push(`Open roles are concentrated in ${concentrated.join(", ")}.`);
  }

  if (roles.length === 0) {
    evidence.push("No public open roles were found in reviewed hiring sources.");
  }

  const score = Math.min(100, points);
  return {
    level: score >= 70 ? "severe" : score >= 45 ? "elevated" : score >= 20 ? "moderate" : "low",
    score,
    indicators: indicators.length ? indicators : ["No elevated public staffing strain indicators found."],
    evidence
  };
}

function concentratedDepartments(metrics: StaffingMetrics) {
  if (metrics.totalOpenPositions < 4) return [];
  return Object.entries(metrics.openPositionsByDepartment)
    .filter(([, count]) => count >= 3 && count / metrics.totalOpenPositions >= 0.4)
    .map(([department]) => department)
    .filter((department) => /program|operations|finance|development|human resources|technology/i.test(department));
}
