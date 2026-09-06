import { Link } from "react-router-dom";
import type { Report } from "../types";
import { PROBLEM_TYPE_LABELS } from "../types";
import { SeverityBadge } from "./SeverityBadge";

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
      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <img
        src={report.imageDataUrl}
        alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
        className="h-20 w-20 shrink-0 rounded-xl object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-slate-800">
            {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          </p>
          <span className="shrink-0 text-xs text-slate-400">
            {relativeTime(report.createdAt)}
          </span>
        </div>
        <p className="line-clamp-1 text-sm text-slate-500">
          {report.location || "بدون موقع محدد"}
        </p>
        <div className="mt-1">
          <SeverityBadge severity={report.analysis.severity} />
        </div>
      </div>
    </Link>
  );
}
