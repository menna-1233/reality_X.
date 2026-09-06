import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SeverityBadge } from "../components/SeverityBadge";
import { StatusBadge } from "../components/StatusBadge";
import { getReport } from "../lib/storage";
import { PROBLEM_TYPE_LABELS } from "../types";
import type { Report, ReportStatus } from "../types";

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

  useEffect(() => {
    setReport(id ? getReport(id) ?? null : null);
  }, [id]);

  if (report === undefined) return null;

  if (report === null) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10 text-center text-slate-400">
        <p>البلاغ غير موجود</p>
        <Link to="/feed" className="text-brand-400 underline">
          الرجوع لكل البلاغات
        </Link>
      </div>
    );
  }

  const confidencePct = Math.round(report.analysis.confidence * 100);
  const stepIndex = statusStepIndex(report.status);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <Link to="/feed" className="flex items-center gap-1 text-sm text-brand-400">
        <ArrowRight size={16} /> رجوع لكل البلاغات
      </Link>

      <div className="glass-panel overflow-hidden rounded-3xl border border-white/10">
        <img
          src={report.imageDataUrl}
          alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          className="h-56 w-full object-cover"
        />
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">
              {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
            </h1>
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={report.analysis.severity} />
              <StatusBadge status={report.status} />
            </div>
          </div>

          {report.location && (
            <p className="flex items-center gap-1 text-sm text-slate-400">
              <MapPin size={14} /> {report.location}
            </p>
          )}

          {report.description && (
            <p className="rounded-xl bg-white/5 p-3 text-sm text-slate-200">
              {report.description}
            </p>
          )}

          <div className="space-y-2 border-t border-white/10 pt-3">
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
                  className="h-2 rounded-full bg-brand-400"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/10 p-4">
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
                        ? "border-brand-300 bg-brand-500"
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
                      i < stepIndex ? "bg-brand-400" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
