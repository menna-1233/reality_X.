import type { Report, Severity } from "../types";
import { PROBLEM_TYPE_LABELS } from "../types";
import { SeverityBadge } from "./SeverityBadge";

const ACCENT: Record<Severity, string> = {
  low: "border-s-severity-low",
  medium: "border-s-severity-medium",
  high: "border-s-severity-high",
  critical: "border-s-severity-critical",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export function ReportCard({
  report,
  onOpen,
}: {
  report: Report;
  onOpen: (report: Report) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className={`flex w-full gap-3 rounded-2xl border-s-2 border border-white/8 bg-white/[0.03] p-3 text-start shadow-sm backdrop-blur-xl transition hover:bg-white/[0.06] ${ACCENT[report.analysis.severity]}`}
    >
      <img
        src={report.imageDataUrl}
        alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
        className="h-20 w-20 shrink-0 rounded-xl object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-mist-100">
            {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          </p>
          <span className="shrink-0 text-xs text-mist-500">
            {relativeTime(report.createdAt)}
          </span>
        </div>
        <p className="line-clamp-1 text-sm text-mist-500">
          {report.location || "بدون موقع محدد"}
        </p>
        <div className="mt-1">
          <SeverityBadge severity={report.analysis.severity} />
        </div>
      </div>
    </button>
  );
}
