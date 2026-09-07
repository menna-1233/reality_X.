import type { Report } from "../types";

export interface ReportGroup {
  key: string;
  reports: Report[]; // newest first
}

function normalizeLocation(location: string): string {
  return location.trim().toLowerCase();
}

/**
 * Groups reports that describe the same problem: same problem type reported
 * at the same location. Reports without a location never get grouped, since
 * an empty location isn't a reliable match signal.
 */
export function groupReports(reports: Report[]): ReportGroup[] {
  const buckets = new Map<string, Report[]>();
  const order: string[] = [];

  for (const report of reports) {
    const location = normalizeLocation(report.location);
    const key = location ? `${report.analysis.problemType}|${location}` : `solo|${report.id}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(report);
  }

  return order.map((key) => ({ key, reports: buckets.get(key)! }));
}

export function findReportGroup(reportId: string, allReports: Report[]): Report[] {
  const group = groupReports(allReports).find((g) =>
    g.reports.some((r) => r.id === reportId),
  );
  return group ? group.reports : allReports.filter((r) => r.id === reportId);
}
