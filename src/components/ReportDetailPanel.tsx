import { Link2, MapPin, Sparkles, X } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";
import { PROBLEM_TYPE_LABELS } from "../types";
import type { Report } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">
        {label}
      </span>
      <span className="text-sm font-medium text-mist-100">{value}</span>
    </div>
  );
}

export function ReportDetailPanel({
  report,
  linkedReports = [],
  onClose,
}: {
  report: Report;
  linkedReports?: Report[];
  onClose: () => void;
}) {
  const confidencePct = Math.round(report.analysis.confidence * 100);
  const reportCode = `BLG-${report.id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-e border-white/8 bg-ink-900/90 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-mist-500">{reportCode}</p>
          <h2 className="text-lg font-bold text-mist-100">
            {PROBLEM_TYPE_LABELS[report.analysis.problemType]}
          </h2>
          {linkedReports.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ember-400">
              <Link2 size={11} /> {linkedReports.length + 1} بلاغات عن نفس المشكلة
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist-300 transition hover:bg-white/8 hover:text-mist-100"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <SeverityBadge severity={report.analysis.severity} />

        <div className="overflow-hidden rounded-2xl border border-white/8">
          <img
            src={report.imageDataUrl}
            alt={PROBLEM_TYPE_LABELS[report.analysis.problemType]}
            className="h-48 w-full object-cover"
          />
        </div>

        {report.description && (
          <p className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-mist-300">
            {report.description}
          </p>
        )}

        <section>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-mist-100">
            <MapPin size={14} className="text-ember-400" /> الملخص
          </h3>
          <div className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-white/[0.02] px-4">
            <Row label="الموقع" value={report.location || "بدون موقع محدد"} />
            <Row label="الجهة المسؤولة" value={report.analysis.department} />
            <Row
              label="نسبة الثقة"
              value={
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-ember-500"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </span>
                  {confidencePct}%
                </span>
              }
            />
            <Row label="تاريخ البلاغ" value={formatDate(report.createdAt)} />
          </div>
        </section>

        <section>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-mist-100">
            <Sparkles size={14} className="text-ember-400" /> تحليل الـ AI
          </h3>
          <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-sm text-mist-300">
            {report.analysis.summary}
          </p>
        </section>

        {linkedReports.length > 0 && (
          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-mist-100">
              <Link2 size={14} className="text-ember-400" /> بلاغات أخرى عن نفس المشكلة
            </h3>
            <div className="space-y-2">
              {linkedReports.map((linked) => (
                <div
                  key={linked.id}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5"
                >
                  <img
                    src={linked.imageDataUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-mist-100">
                      {linked.description || "بدون وصف"}
                    </p>
                    <p className="text-xs text-mist-500">
                      {formatDate(linked.createdAt)} · {formatTime(linked.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold text-mist-100">السجل</h3>
          <ol className="space-y-3 border-s border-white/10 ps-4">
            <li className="relative text-sm">
              <span className="absolute -start-[21px] top-1 h-2 w-2 rounded-full bg-ember-500" />
              <p className="text-mist-100">تم إنشاء البلاغ</p>
              <p className="text-xs text-mist-500">
                {formatDate(report.createdAt)} · {formatTime(report.createdAt)}
              </p>
            </li>
            <li className="relative text-sm">
              <span className="absolute -start-[21px] top-1 h-2 w-2 rounded-full bg-white/20" />
              <p className="text-mist-100">
                الـ AI حدد نوع المشكلة وخطورتها تلقائيًا
              </p>
              <p className="text-xs text-mist-500">
                {formatDate(report.createdAt)} · {formatTime(report.createdAt)}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
