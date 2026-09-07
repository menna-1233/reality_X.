import { parseLatLng } from "./geo";
import type { Incident, Report, ReportStatus, Severity } from "../types";

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const STATUS_RANK: Record<ReportStatus, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

/**
 * Same real-world problem, reported more than once, should key the same:
 * same problem type + same rough spot (~100m grid on parsed coordinates,
 * else the raw location text). This is the same "mock AI" spirit as
 * mockAnalyze.ts — a simple heuristic standing in for real deduplication.
 */
function locationBucket(location: string): string {
  const latLng = parseLatLng(location);
  if (latLng) {
    const [lat, lng] = latLng;
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
  }
  return location.trim().toLowerCase();
}

function incidentKey(report: Report): string {
  return `${report.analysis.problemType}::${locationBucket(report.location)}`;
}

/** Aggregate status: if anything is still actionable, the incident is too. */
function aggregateStatus(reports: Report[]): ReportStatus {
  const open = reports.some((r) => r.status === "open");
  if (open) return "open";
  const inProgress = reports.some((r) => r.status === "in_progress");
  if (inProgress) return "in_progress";
  const resolved = reports.some((r) => r.status === "resolved");
  if (resolved) return "resolved";
  return "closed";
}

export function groupIntoIncidents(reports: Report[]): Incident[] {
  const groups = new Map<string, Report[]>();
  for (const report of reports) {
    const key = incidentKey(report);
    const list = groups.get(key);
    if (list) list.push(report);
    else groups.set(key, [report]);
  }

  const incidents: Incident[] = [];
  for (const [key, members] of groups) {
    const sorted = members
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const worstSeverity = members.reduce<Severity>(
      (acc, r) => (SEVERITY_RANK[r.analysis.severity] > SEVERITY_RANK[acc] ? r.analysis.severity : acc),
      members[0].analysis.severity,
    );
    incidents.push({
      id: key,
      problemType: sorted[0].analysis.problemType,
      severity: worstSeverity,
      status: aggregateStatus(members),
      department: sorted[0].analysis.department,
      location: sorted[sorted.length - 1].location,
      createdAt: sorted[0].createdAt,
      latestAt: sorted[sorted.length - 1].createdAt,
      reports: sorted,
    });
  }

  return incidents.sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
  });
}

/** Every other report the AI linked to this one as the same real-world problem. */
export function findLinkedReports(report: Report, allReports: Report[]): Report[] {
  const key = incidentKey(report);
  return allReports.filter((r) => r.id !== report.id && incidentKey(r) === key);
}

/** reportId -> every OTHER report grouped with it (empty array if it's on its own). */
export function buildLinkedReportsLookup(reports: Report[]): Map<string, Report[]> {
  const map = new Map<string, Report[]>();
  for (const incident of groupIntoIncidents(reports)) {
    if (incident.reports.length < 2) continue;
    for (const r of incident.reports) {
      map.set(r.id, incident.reports.filter((other) => other.id !== r.id));
    }
  }
  return map;
}
