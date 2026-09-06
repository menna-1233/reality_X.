import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SeverityBadge } from "../components/SeverityBadge";
import { getReport } from "../lib/storage";
import { PROBLEM_TYPE_LABELS } from "../types";
import type { Report } from "../types";

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null | undefined>(undefined);

  useEffect(() => {
    setReport(id ? getReport(id) ?? null : null);
  }, [id]);

  if (report === undefined) return null;

  if (report === null) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10 text-center text-slate-500">
        <p>البلاغ غير موجود</p>
        <Link to="/feed" className="text-brand-600 underline">
          الرجوع لكل البلاغات
        </Link>
      </div>
    );
  }

  const confidencePct = Math.round(report.analysis.confidence * 100);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <Link to="/feed" className="flex items-center gap-1 text-sm text-brand-600">
        <ArrowRight size={16} /> رجوع لكل البلاغات
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <img
          src={report.imageDataUrl}
          alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          className="h-56 w-full object-cover"
        />
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-800">
              {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
            </h1>
            <SeverityBadge severity={report.analysis.severity} />
          </div>

          {report.location && (
            <p className="flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={14} /> {report.location}
            </p>
          )}

          {report.description && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {report.description}
            </p>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-sm font-semibold text-slate-700">تحليل الـ AI</p>
            <p className="text-sm text-slate-600">{report.analysis.summary}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">الجهة المسؤولة</span>
              <span className="font-medium text-slate-800">{report.analysis.department}</span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>نسبة الثقة</span>
                <span>{confidencePct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-brand-500"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
