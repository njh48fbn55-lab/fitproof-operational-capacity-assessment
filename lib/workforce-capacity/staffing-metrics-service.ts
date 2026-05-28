import { CareersRole, StaffingMetrics, WorkforceSizeEstimate } from "./types";

export function staffingMetricsService(roles: CareersRole[], workforceSize: WorkforceSizeEstimate): StaffingMetrics {
  const datedRoles = roles
    .map((role) => ({ role, age: requisitionAgeDays(role) }))
    .filter((item): item is { role: CareersRole; age: number } => item.age !== null);
  const totalOpenPositions = roles.length;
  const openPositionsByDepartment = roles.reduce<Record<string, number>>((counts, role) => {
    const department = role.department || "Uncategorized";
    counts[department] = (counts[department] || 0) + 1;
    return counts;
  }, {});
  const leadershipOpenings = roles.filter((role) => role.leadershipLevel === "executive" || role.leadershipLevel === "senior_leader").length;
  const estimatedEmployeeCount = workforceSize.confidence === "high" || workforceSize.confidence === "medium" ? workforceSize.estimatedEmployeeCount : null;

  return {
    totalOpenPositions,
    openPositionsByDepartment,
    leadershipOpenings,
    openRoleRatio: estimatedEmployeeCount && estimatedEmployeeCount > 0 ? round(totalOpenPositions / estimatedEmployeeCount) : null,
    averageRequisitionAgeDays: datedRoles.length ? Math.round(datedRoles.reduce((sum, item) => sum + item.age, 0) / datedRoles.length) : null,
    percentOpenMoreThan30Days: percentOlderThan(datedRoles, 30),
    percentOpenMoreThan60Days: percentOlderThan(datedRoles, 60),
    percentOpenMoreThan90Days: percentOlderThan(datedRoles, 90)
  };
}

export function requisitionAgeDays(role: Pick<CareersRole, "postedDate" | "firstSeenAt" | "lastSeenAt">) {
  const raw = role.postedDate || historicalFirstSeenAt(role);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}

function historicalFirstSeenAt(role: Pick<CareersRole, "firstSeenAt" | "lastSeenAt">) {
  if (!role.firstSeenAt) return null;
  if (!role.lastSeenAt) return role.firstSeenAt;
  const firstSeenDate = new Date(role.firstSeenAt);
  const lastSeenDate = new Date(role.lastSeenAt);
  if (!Number.isFinite(firstSeenDate.getTime()) || !Number.isFinite(lastSeenDate.getTime())) return null;
  return firstSeenDate.toDateString() === lastSeenDate.toDateString() ? null : role.firstSeenAt;
}

function percentOlderThan(items: Array<{ age: number }>, days: number) {
  if (!items.length) return null;
  return round(items.filter((item) => item.age > days).length / items.length);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
