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
}

export const PROBLEM_TYPE_LABELS: Record<ProblemType, string> = {
  pothole: "حفرة في الطريق",
  garbage: "تراكم زبالة",
  water_leak: "تسريب مياه",
  broken_light: "عمود نور بايظ",
  accident: "حادث",
  other: "مشكلة أخرى",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "مفتوح",
  in_progress: "جاري التنفيذ",
  resolved: "تم الحل",
  closed: "مغلق",
};

export const EVENT_LABELS: Record<ReportEventKind, string> = {
  created: "تم إنشاء البلاغ",
  analyzed: "تم تحليله بالـ AI",
  status_changed: "تغييرت الحالة",
};
