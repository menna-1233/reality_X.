import { Inbox, Search } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { ReportCard } from "../components/ReportCard";
import { buildLinkedReportsLookup } from "../lib/incidents";
import { severityLabel } from "../lib/labels";
import { listReports } from "../lib/storage";
import type { Report, Severity } from "../types";

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f59e0b",
  critical: "#ef4444",
};

const FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];

export function FeedPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listReports()
      .then((all) => setReports(all.filter((r) => r.status !== "resolved" && r.status !== "closed")))
      .catch(() => setReports([]));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const f of FILTERS) {
      if (f === "all") continue;
      c[f] = reports.filter((r) => r.analysis.severity === f).length;
    }
    return c;
  }, [reports]);

  const openCount = useMemo(
    () => reports.filter((r) => r.status === "open" || r.status === "in_progress").length,
    [reports],
  );
  const criticalCount = counts.critical ?? 0;

  const bySeverity =
    filter === "all" ? reports : reports.filter((r) => r.analysis.severity === filter);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bySeverity;
    const qId = q.startsWith("#") ? q.slice(1) : q;
    return bySeverity.filter((r) => {
      const hay = `${r.id} ${r.description} ${r.location}`.toLowerCase();
      return hay.includes(q) || (qId.length > 0 && r.id.toLowerCase().includes(qId));
    });
  }, [bySeverity, search]);

  const linkedLookup = useMemo(() => buildLinkedReportsLookup(reports), [reports]);

  return (
    <AppShell title={t("common.allReports")}>
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm text-slate-400">{t("feedPage.subtitle")}</p>

        {reports.length > 0 && (
          <div className="surface-panel flex items-center justify-between rounded-xl border border-white/8 px-4 py-2.5 text-xs">
            <span className="text-slate-300">
              <b className="font-mono text-sm text-white">{openCount}</b> {t("feedPage.openReportsSuffix")}
            </span>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <b className="font-mono text-sm text-severity-critical">{criticalCount}</b>{" "}
                {t("feedPage.criticalSuffix")}
                <span className="h-1.5 w-1.5 rounded-full bg-severity-critical" />
                {t("feedPage.needsResponseToday")}
              </span>
            )}
          </div>
        )}

        {reports.length > 0 && (
          <div className="surface-panel flex items-center gap-2 rounded-lg border border-white/8 px-3.5 py-2 md:max-w-sm">
            <Search size={15} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.searchPlaceholder")}
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {reports.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <Chip
                key={f}
                active={filter === f}
                onClick={() => setFilter(f)}
                dot={f === "all" ? undefined : SEVERITY_COLOR[f]}
                count={counts[f] ?? 0}
              >
                {f === "all" ? t("common.all") : severityLabel(t, f)}
              </Chip>
            ))}
          </div>
        )}

        {reports.length === 0 ? (
          <EmptyState icon={Inbox} title={t("feedPage.emptyNoReports")} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Inbox} title={t("feedPage.emptyNoMatch")} />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visible.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
              >
                <ReportCard report={report} linkedCount={linkedLookup.get(report.id)?.length ?? 0} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
