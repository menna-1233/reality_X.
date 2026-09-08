import { Link2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { LocationLabel } from "../components/LocationLabel";
import { SeverityBadge } from "../components/SeverityBadge";
import { StatusBadge } from "../components/StatusBadge";
import { findLinkedReports } from "../lib/incidents";
import { getReport, listReports } from "../lib/storage";
import { PROBLEM_TYPE_LABELS } from "../types";
import type { Report, ReportStatus } from "../types";

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

const TRAIL: { key: ReportStatus; label: string }[] = [
  { key: "open", label: "تم الإبلاغ" },
  { key: "open", label: "مفتوح" },
  { key: "in_progress", label: "جاري التنفيذ" },
  { key: "resolved", label: "تم الحل" },
];

function statusStepIndex(status: ReportStatus): number {
  if (status === "closed") return -1;
  if (status === "resolved") return 3;
  if (status === "in_progress") return 2;
  return 1;
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [allReports, setAllReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!id) {
      setReport(null);
      return;
    }
    setReport(undefined);
    Promise.all([getReport(id), listReports()]).then(([found, all]) => {
      setReport(found ?? null);
      setAllReports(all);
    });
  }, [id]);

  if (report === undefined) return null;

  if (report === null) {
    return (
      <AppShell title="البلاغ غير موجود" breadcrumbs={["البلاغات"]}>
        <div className="mx-auto max-w-lg space-y-4 py-10 text-center text-slate-400">
          <p>البلاغ غير موجود</p>
          <Link to="/feed" className="text-accent-400 underline">
            الرجوع لكل البلاغات
          </Link>
        </div>
      </AppShell>
    );
  }

  const confidencePct = Math.round(report.analysis.confidence * 100);
  const stepIndex = statusStepIndex(report.status);
  const linkedReports = findLinkedReports(report, allReports);

  return (
    <AppShell
      title={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
      breadcrumbs={["البلاغات", `#${report.id.slice(0, 6)}`]}
    >
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/feed" className="text-sm text-accent-400">
          ← رجوع لكل البلاغات
        </Link>

        <div className="surface-panel overflow-hidden rounded-xl border border-white/8">
          <img
            src={report.imageDataUrl}
            alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
            className="h-56 w-full object-cover"
          />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
              </h2>
              <div className="flex items-center gap-1.5">
                <SeverityBadge severity={report.analysis.severity} />
                <StatusBadge status={report.status} />
              </div>
            </div>

            {report.location && (
              <p className="flex items-center gap-1 text-sm text-slate-400">
                <MapPin size={14} /> <LocationLabel location={report.location} />
              </p>
            )}

            {report.description && (
              <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-200">
                {report.description}
              </p>
            )}

            <div className="space-y-2 border-t border-white/8 pt-3">
              <p className="text-sm font-semibold text-slate-200">تحليل الـ AI</p>
              <p className="text-sm text-slate-400">{report.analysis.summary}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">الجهة المسؤولة</span>
                <span className="font-medium text-slate-200">{report.analysis.department}</span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>نسبة الثقة</span>
                  <span className="font-mono">{confidencePct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-accent-500"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-panel rounded-xl border border-white/8 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            مسار الحالة
          </p>
          {report.status === "closed" ? (
            <p className="text-sm text-slate-400">تم إغلاق البلاغ بدون اعتباره محلولاً.</p>
          ) : (
            <div className="flex items-start">
              {TRAIL.map((step, i) => (
                <div key={i} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        i <= stepIndex
                          ? "border-accent-400 bg-accent-500"
                          : "border-white/15 bg-ink-800"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-center text-[11px] font-medium ${
                        i <= stepIndex ? "text-slate-200" : "text-slate-600"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < TRAIL.length - 1 && (
                    <span
                      className={`mx-1 h-0.5 flex-1 rounded-full ${
                        i < stepIndex ? "bg-accent-400" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {linkedReports.length > 0 && (
          <div className="surface-panel rounded-xl border border-accent-400/20 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-400">
              <Link2 size={13} />
              الـ AI ربط البلاغ ده بـ {linkedReports.length} بلاغ تاني عن نفس المشكلة
            </p>
            <div className="space-y-2">
              {linkedReports.map((r) => (
                <Link
                  key={r.id}
                  to={`/reports/${r.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-2 transition hover:bg-white/[0.06]"
                >
                  <img src={r.imageDataUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">
                      {r.description || PROBLEM_TYPE_LABELS[r.analysis.problemType]}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{relativeTime(r.createdAt)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
