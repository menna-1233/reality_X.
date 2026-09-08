import { ArrowLeft, Link2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { LocationLabel } from "../components/LocationLabel";
import { SeverityBadge } from "../components/SeverityBadge";
import { StatusBadge } from "../components/StatusBadge";
import { findLinkedReports } from "../lib/incidents";
import { departmentLabel, problemTypeLabel } from "../lib/labels";
import { getReport, listReports } from "../lib/storage";
import { formatRelativeTime } from "../lib/time";
import type { Report, ReportStatus } from "../types";

// key stays "open" for both trail steps below — statusStepIndex compares
// against the step's *position*, not this field, so the repeat is fine.
const TRAIL: { key: ReportStatus; labelKey: string }[] = [
  { key: "open", labelKey: "reportDetailPage.trailReported" },
  { key: "open", labelKey: "status.open" },
  { key: "in_progress", labelKey: "status.in_progress" },
  { key: "resolved", labelKey: "status.resolved" },
];

function statusStepIndex(status: ReportStatus): number {
  if (status === "closed") return -1;
  if (status === "resolved") return 3;
  if (status === "in_progress") return 2;
  return 1;
}

export function ReportDetailPage() {
  const { t } = useTranslation();
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
      <AppShell title={t("reportDetailPage.notFoundTitle")}>
        <div className="mx-auto max-w-lg space-y-4 py-10 text-center text-slate-400">
          <p>{t("reportDetailPage.notFoundBody")}</p>
          <Link to="/feed" className="text-accent-400 underline">
            {t("reportDetailPage.backToAll")}
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
      title={problemTypeLabel(t, report.analysis.problemType)}
      breadcrumbs={[`#${report.id.slice(0, 6)}`]}
    >
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-accent-400">
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {t("reportDetailPage.backToAll")}
        </Link>

        <div className="surface-panel overflow-hidden rounded-xl border border-white/8">
          <img
            src={report.imageDataUrl}
            alt={problemTypeLabel(t, report.analysis.problemType)}
            className="h-56 w-full object-cover"
          />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {problemTypeLabel(t, report.analysis.problemType)}
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
              <p className="text-sm font-semibold text-slate-200">{t("reportDetailPage.aiAnalysis")}</p>
              <p className="text-sm text-slate-400">{report.analysis.summary}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("common.department")}</span>
                <span className="font-medium text-slate-200">{departmentLabel(t, report.analysis.problemType)}</span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{t("common.confidence")}</span>
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
            {t("reportDetailPage.statusTrail")}
          </p>
          {report.status === "closed" ? (
            <p className="text-sm text-slate-400">{t("reportDetailPage.closedNotice")}</p>
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
                      {t(step.labelKey)}
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
              {t("reportDetailPage.linkedNotice", { count: linkedReports.length })}
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
                      {r.description || problemTypeLabel(t, r.analysis.problemType)}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{formatRelativeTime(r.createdAt, t)}</p>
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
