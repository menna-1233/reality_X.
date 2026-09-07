import { apiCreateReport, apiGetReport, apiListReports, apiSetReportStatus } from "./api";
import type { SubmitReportInput } from "./api";
import type { Report, ReportEvent, ReportStatus } from "../types";

/**
 * Thin wrapper around the real backend (see ./api.ts) — kept as its own
 * module so the rest of the app doesn't need to know it used to be
 * localStorage-backed.
 */

export async function listReports(): Promise<Report[]> {
  return apiListReports();
}

export async function getReport(id: string): Promise<Report | undefined> {
  return apiGetReport(id);
}

export async function addReport(input: SubmitReportInput): Promise<Report> {
  return apiCreateReport(input);
}

export async function setReportStatus(id: string, status: ReportStatus): Promise<Report> {
  return apiSetReportStatus(id, status);
}

/** Pure helper over an already-fetched report list — no network call. */
export function listRecentEvents(
  reports: Report[],
  limit = 8,
): { report: Report; event: ReportEvent }[] {
  return reports
    .flatMap((report) => report.events.map((event) => ({ report, event })))
    .sort((a, b) => new Date(b.event.at).getTime() - new Date(a.event.at).getTime())
    .slice(0, limit);
}
