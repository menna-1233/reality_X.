import type { Report, ReportStatus } from "../types";

const STORAGE_KEY = "urbaneye.reports";

function readAll(): Report[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Report[]) : [];
  } catch {
    return [];
  }
}

function writeAll(reports: Report[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // localStorage might be unavailable (private mode, quota) — fail silently
    // for this MVP; a real backend call would be the source of truth instead.
  }
}

export function listReports(): Report[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getReport(id: string): Report | undefined {
  return readAll().find((r) => r.id === id);
}

export function addReport(report: Report): void {
  const all = readAll();
  all.push(report);
  writeAll(all);
}

export function setReportStatus(id: string, status: ReportStatus): void {
  const all = readAll();
  const report = all.find((r) => r.id === id);
  if (!report) return;
  report.status = status;
  writeAll(all);
}
