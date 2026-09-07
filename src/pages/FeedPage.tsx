import { Inbox } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { ReportCard } from "../components/ReportCard";
import { buildLinkedReportsLookup } from "../lib/incidents";
import { listReports } from "../lib/storage";
import type { Report, Severity } from "../types";
import { SEVERITY_LABELS } from "../types";

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f59e0b",
  critical: "#ef4444",
};

const FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];

export function FeedPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Severity | "all">("all");

  useEffect(() => {
    setReports(listReports());
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

  const visible =
    filter === "all" ? reports : reports.filter((r) => r.analysis.severity === filter);

  const linkedLookup = useMemo(() => buildLinkedReportsLookup(reports), [reports]);

  return (
    <AppShell title="كل البلاغات" breadcrumbs={["البلاغات"]}>
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-slate-400">
          كل بلاغ هنا اتحلل بالـ AI ووصل لإدارة الكمباوند تلقائيًا.
        </p>

        {reports.length > 0 && (
          <div className="surface-panel flex items-center justify-between rounded-xl border border-white/8 px-4 py-2.5 text-xs">
            <span className="text-slate-300">
              <b className="font-mono text-sm text-white">{openCount}</b> بلاغ مفتوح
            </span>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1.5 text-slate-300">
                <b className="font-mono text-sm text-severity-critical">{criticalCount}</b> حرجة
                <span className="h-1.5 w-1.5 rounded-full bg-severity-critical" />
                محتاجة رد اليوم
              </span>
            )}
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
                {f === "all" ? "الكل" : SEVERITY_LABELS[f]}
              </Chip>
            ))}
          </div>
        )}

        {reports.length === 0 ? (
          <EmptyState icon={Inbox} title="لسه مفيش بلاغات، جرّب ترسل بلاغ جديد" />
        ) : visible.length === 0 ? (
          <EmptyState icon={Inbox} title="مفيش بلاغات بالفلتر ده دلوقتي" />
        ) : (
          <div className="space-y-3">
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
