import { Link } from "react-router-dom";
import type { Report, Severity } from "../types";
import { PROBLEM_TYPE_LABELS } from "../types";
import { SeverityBadge } from "./SeverityBadge";
import { StatusBadge } from "./StatusBadge";

const STRIPE: Record<Severity, string> = {
  low: "before:bg-severity-low",
  medium: "before:bg-severity-medium",
  high: "before:bg-severity-high",
  critical: "before:bg-severity-critical",
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

export function ReportCard({ report }: { report: Report }) {
  return (
    <Link
      to={`/reports/${report.id}`}
      className={`glass-panel relative flex gap-3 overflow-hidden rounded-2xl border border-white/10 p-3 pe-4 transition
        before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full
        hover:border-brand-400/40 hover:bg-white/[0.08]
        ${STRIPE[report.analysis.severity]}`}
    >
      <img
        src={report.imageDataUrl}
        alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
        className="h-16 w-16 shrink-0 rounded-xl object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-slate-100">
            {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          </p>
          <span className="shrink-0 font-mono text-[11px] text-slate-500">
            {relativeTime(report.createdAt)}
          </span>
        </div>
        <p className="line-clamp-1 flex items-center gap-1 text-sm text-slate-400">
          <span className="text-slate-500">📍</span>
          {report.location || "بدون موقع محدد"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={report.analysis.severity} />
          <StatusBadge status={report.status} />
        </div>
      </div>
    </Link>
  );
}
