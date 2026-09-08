export type Severity = "low" | "medium" | "high" | "critical";

export type ReportStatus = "open" | "in_progress" | "resolved" | "closed";

export type ReportEventKind = "created" | "analyzed" | "status_changed";

export interface ReportEvent {
  at: string; // ISO date
  kind: ReportEventKind;
  note?: string;
}

export type ProblemType =
  | "pothole"
  | "garbage"
  | "water_leak"
  | "broken_light"
  | "accident"
  | "other";

export interface Analysis {
  problemType: ProblemType;
  severity: Severity;
  department: string;
  confidence: number; // 0..1
  summary: string;
}

export interface Report {
  id: string;
  imageDataUrl: string;
  description: string;
  location: string;
  createdAt: string; // ISO date
  analysis: Analysis;
  status: ReportStatus;
  events: ReportEvent[];
  /** Set by the backend when it groups this report with others as one real-world problem. */
  incidentId: string | null;
}

/**
 * A cluster of reports the AI grouped as the same real-world problem
 * (same problem type, same/nearby location). Derived on the fly from
 * reports — never stored — so it always reflects current data.
 */
export interface Incident {
  id: string;
  problemType: ProblemType;
  severity: Severity;
  status: ReportStatus;
  department: string;
  location: string;
  createdAt: string; // earliest member report
  latestAt: string; // most recent member report
  reports: Report[];
}

// Display labels for these enums live in the i18n locale files
// (src/i18n/locales/*.json, under problemType/severity/status/event) and are
// resolved via src/lib/labels.ts — not here, so they can be translated.
