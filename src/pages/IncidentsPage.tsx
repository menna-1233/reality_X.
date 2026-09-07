import { Layers, Search, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { FilterPanel } from "../components/FilterPanel";
import type { FilterGroup } from "../components/FilterPanel";
import { AppShell } from "../components/AppShell";
import { SeverityBadge } from "../components/SeverityBadge";
import { SlideOver } from "../components/SlideOver";
import { StatusBadge } from "../components/StatusBadge";
import { groupIntoIncidents } from "../lib/incidents";
import { listReports, setReportStatus } from "../lib/storage";
import type { Incident, ReportStatus, Severity } from "../types";
import { PROBLEM_TYPE_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../types";

const STATUS_ORDER: ReportStatus[] = ["open", "in_progress", "resolved", "closed"];
const STATUS_COLOR: Record<ReportStatus, string> = {
  open: "#3cc0ff",
  in_progress: "#818cf8",
  resolved: "#22c55e",
  closed: "#6b7787",
};
const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f59e0b",
  critical: "#ef4444",
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

export function IncidentsPage() {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ severity: "all", status: "all" });
  const [selected, setSelected] = useState<Incident | null>(null);

  const incidents = useMemo(() => groupIntoIncidents(listReports()), [version]);

  useEffect(() => {
    setVersion((v) => v + 1);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (filters.severity !== "all" && inc.severity !== filters.severity) return false;
      if (filters.status !== "all" && inc.status !== filters.status) return false;
      if (!q) return true;
      const hay = `${PROBLEM_TYPE_LABELS[inc.problemType]} ${inc.location}`.toLowerCase();
      return hay.includes(q);
    });
  }, [incidents, filters, search]);

  function refreshAndSync(id: string) {
    setVersion((v) => v + 1);
    setSelected((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updated = groupIntoIncidents(listReports()).find((i) => i.id === id);
      return updated ?? null;
    });
  }

  function cascadeStatus(incident: Incident, status: ReportStatus) {
    for (const r of incident.reports) setReportStatus(r.id, status);
    refreshAndSync(incident.id);
  }

  const filterGroups: FilterGroup[] = [
    {
      key: "severity",
      label: "الخطورة",
      options: [
        { value: "all", label: "الكل" },
        ...(["critical", "high", "medium", "low"] as Severity[]).map((s) => ({
          value: s,
          label: SEVERITY_LABELS[s],
          dot: SEVERITY_COLOR[s],
        })),
      ],
    },
    {
      key: "status",
      label: "الحالة",
      options: [
        { value: "all", label: "الكل" },
        ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s], dot: STATUS_COLOR[s] })),
      ],
    },
  ];

  const multiReportCount = incidents.filter((i) => i.reports.length > 1).length;

  return (
    <AppShell
      title="الحوادث"
      breadcrumbs={["الإدارة", "الحوادث"]}
      actions={<FilterPanel groups={filterGroups} active={filters} onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="surface-panel flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-white/8 px-3.5 py-2 md:max-w-sm md:flex-none">
            <Search size={15} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الحوادث..."
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
          {multiReportCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Layers size={13} />
              {multiReportCount} حادث اتربط فيه أكتر من بلاغ تلقائيًا بالـ AI
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="لا توجد حوادث مطابقة" />
        ) : (
          <div className="space-y-2">
            {filtered.map((inc, i) => (
              <motion.button
                key={inc.id}
                onClick={() => setSelected(inc)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
                className="surface-panel flex w-full items-center gap-4 rounded-xl border border-white/8 p-3.5 text-start transition hover:border-accent-400/30 hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-100">
                      {PROBLEM_TYPE_LABELS[inc.problemType]}
                    </p>
                    {inc.reports.length > 1 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-400">
                        <Users size={10} />×{inc.reports.length}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{inc.location}</p>
                </div>
                <SeverityBadge severity={inc.severity} />
                <StatusBadge status={inc.status} />
                <span className="hidden shrink-0 font-mono text-[11px] text-slate-600 sm:inline">
                  {relativeTime(inc.latestAt)}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <SlideOver
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? PROBLEM_TYPE_LABELS[selected.problemType] : ""}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={selected.severity} />
              <span className="text-slate-600">·</span>
              <StatusBadge status={selected.status} />
              <span className="ms-auto flex items-center gap-1 rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold text-accent-400">
                <Users size={10} />
                {selected.reports.length} بلاغ
              </span>
            </div>
            <p className="text-sm text-slate-400">{selected.location}</p>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400">تحديث حالة الحادث بالكامل</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_ORDER.map((s) => (
                  <Chip
                    key={s}
                    active={selected.status === s}
                    onClick={() => cascadeStatus(selected, s)}
                    dot={STATUS_COLOR[s]}
                  >
                    {STATUS_LABELS[s]}
                  </Chip>
                ))}
              </div>
              <p className="text-[10px] text-slate-600">هيغيّر حالة كل الـ {selected.reports.length} بلاغات المرتبطة بيه.</p>
            </div>

            <div className="space-y-2 border-t border-white/8 pt-3">
              <p className="text-[11px] font-semibold text-slate-400">البلاغات المرتبطة</p>
              {selected.reports.map((r) => (
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
      </SlideOver>
    </AppShell>
  );
}
