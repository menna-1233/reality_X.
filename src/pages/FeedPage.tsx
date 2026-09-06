import { Inbox } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReportCard } from "../components/ReportCard";
import { listReports } from "../lib/storage";
import type { Report, Severity } from "../types";
import { SEVERITY_LABELS } from "../types";

const FILTERS: { key: Severity | "all"; label: string; dot?: string }[] = [
  { key: "all", label: "الكل" },
  { key: "critical", label: SEVERITY_LABELS.critical, dot: "bg-severity-critical" },
  { key: "high", label: SEVERITY_LABELS.high, dot: "bg-severity-high" },
  { key: "medium", label: SEVERITY_LABELS.medium, dot: "bg-severity-medium" },
  { key: "low", label: SEVERITY_LABELS.low, dot: "bg-severity-low" },
];

export function FeedPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Severity | "all">("all");

  useEffect(() => {
    setReports(listReports());
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const f of FILTERS) {
      if (f.key === "all") continue;
      c[f.key] = reports.filter((r) => r.analysis.severity === f.key).length;
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

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-white">كل البلاغات</h1>
        <p className="text-sm text-slate-400">
          كل بلاغ هنا اتحلل بالـ AI ووصل لإدارة الكمباوند تلقائيًا.
        </p>
      </div>

      {reports.length > 0 && (
        <div className="glass-panel flex items-center justify-between rounded-2xl border border-white/10 px-4 py-2.5 text-xs">
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
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? "bg-white text-ink-950"
                  : "glass-panel border border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
              {f.label}
              <span className="opacity-60">· {counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-16 text-slate-500">
          <Inbox size={32} />
          <p>لسه مفيش بلاغات، جرّب ترسل بلاغ جديد</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-16 text-slate-500">
          <p>مفيش بلاغات بالفلتر ده دلوقتي</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
