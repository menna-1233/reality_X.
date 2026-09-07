import {
  CheckCircle2,
  FileText,
  History,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  Link2,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityFeed } from "../components/ActivityFeed";
import type { ActivityItem } from "../components/ActivityFeed";
import { AppShell } from "../components/AppShell";
import { Chip } from "../components/Chip";
import { DataTable } from "../components/DataTable";
import type { DataTableColumn } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterPanel } from "../components/FilterPanel";
import type { FilterGroup } from "../components/FilterPanel";
import { SeverityBadge } from "../components/SeverityBadge";
import { SlideOver } from "../components/SlideOver";
import { StatusBadge } from "../components/StatusBadge";
import { buildLinkedReportsLookup } from "../lib/incidents";
import { listReports, setReportStatus } from "../lib/storage";
import type { Report, ReportStatus, Severity } from "../types";
import {
  EVENT_LABELS,
  PROBLEM_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from "../types";

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

interface DragPoint {
  point: { x: number; y: number };
}

export function FindingsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({
    severity: "all",
    status: "all",
  });
  const [selected, setSelected] = useState<Report | null>(null);
  const [tab, setTab] = useState<"summary" | "evidence" | "history">("summary");
  const columnRefs = useRef<Partial<Record<ReportStatus, HTMLDivElement>>>({});
  const draggedRef = useRef(false);

  function refresh() {
    setReports(listReports());
  }
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (filters.severity !== "all" && r.analysis.severity !== filters.severity) return false;
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (!q) return true;
      const hay =
        `${r.description} ${r.location} ${PROBLEM_TYPE_LABELS[r.analysis.problemType]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, filters, search]);

  const grouped = useMemo(() => {
    const g: Record<ReportStatus, Report[]> = { open: [], in_progress: [], resolved: [], closed: [] };
    for (const r of filtered) g[r.status].push(r);
    return g;
  }, [filtered]);

  const linkedLookup = useMemo(() => buildLinkedReportsLookup(reports), [reports]);

  function openDetail(r: Report) {
    setSelected(r);
    setTab("summary");
  }

  function handleStatusChange(id: string, status: ReportStatus) {
    setReportStatus(id, status);
    const updated = listReports();
    setReports(updated);
    setSelected((prev) => (prev && prev.id === id ? (updated.find((r) => r.id === id) ?? null) : prev));
  }

  function handleDragEnd(report: Report, info: DragPoint) {
    for (const status of STATUS_ORDER) {
      const el = columnRefs.current[status];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const { x, y } = info.point;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        if (status !== report.status) handleStatusChange(report.id, status);
        return;
      }
    }
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

  const columns: DataTableColumn<Report>[] = [
    {
      key: "id",
      label: "المعرف",
      render: (r) => <span className="font-mono text-xs text-slate-500">#{r.id.slice(0, 6)}</span>,
    },
    {
      key: "type",
      label: "النوع",
      render: (r) => {
        const linked = linkedLookup.get(r.id);
        return (
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            {PROBLEM_TYPE_LABELS[r.analysis.problemType]}
            {linked && linked.length > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-400">
                <Link2 size={9} />+{linked.length}
              </span>
            )}
          </span>
        );
      },
    },
    { key: "severity", label: "الخطورة", render: (r) => <SeverityBadge severity={r.analysis.severity} /> },
    { key: "status", label: "الحالة", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "dept",
      label: "الجهة",
      render: (r) => <span className="text-xs text-slate-400">{r.analysis.department}</span>,
    },
    {
      key: "confidence",
      label: "نسبة الثقة",
      render: (r) => (
        <span className="font-mono text-xs text-slate-400">
          {Math.round(r.analysis.confidence * 100)}%
        </span>
      ),
    },
    {
      key: "date",
      label: "التاريخ",
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(r.createdAt).toLocaleDateString("ar-EG-u-nu-latn")}
        </span>
      ),
    },
  ];

  const historyItems: ActivityItem[] = (selected?.events ?? [])
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((e) => ({
      icon: e.kind === "status_changed" ? RefreshCw : e.kind === "analyzed" ? CheckCircle2 : Inbox,
      title: EVENT_LABELS[e.kind],
      time: relativeTime(e.at),
    }));

  return (
    <AppShell
      title="إدارة البلاغات"
      breadcrumbs={["الإدارة", "البلاغات"]}
      actions={
        <div className="flex items-center gap-2">
          <div className="surface-panel flex items-center rounded-lg border border-white/8 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "kanban" ? "bg-accent-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={14} /> كانبان
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "table" ? "bg-accent-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Table2 size={14} /> جدول
            </button>
          </div>
          <FilterPanel groups={filterGroups} active={filters} onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="surface-panel flex items-center gap-2 rounded-lg border border-white/8 px-3.5 py-2 md:max-w-sm">
          <Search size={15} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في البلاغات..."
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="مفيش بلاغات مطابقة لهذا الفلتر!"
            action={
              <button
                onClick={() => {
                  setFilters({ severity: "all", status: "all" });
                  setSearch("");
                }}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
              >
                مسح الفلاتر
              </button>
            }
          />
        ) : view === "table" ? (
          <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} onRowClick={openDetail} />
        ) : (
          <LayoutGroup>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  ref={(el) => {
                    columnRefs.current[status] = el ?? undefined;
                  }}
                  className="surface-panel flex min-h-[200px] flex-col gap-2 rounded-xl border border-white/8 p-2.5"
                >
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: STATUS_COLOR[status] }}
                    />
                    <p className="text-xs font-semibold text-slate-300">{STATUS_LABELS[status]}</p>
                    <span className="ms-auto rounded-full bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {grouped[status].length}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {grouped[status].map((r) => (
                      <motion.div
                        key={r.id}
                        layout
                        layoutId={r.id}
                        drag
                        dragMomentum={false}
                        whileDrag={{
                          scale: 1.05,
                          zIndex: 50,
                          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.7)",
                        }}
                        onDragStart={() => {
                          draggedRef.current = false;
                        }}
                        onDrag={(_e, info) => {
                          if (Math.hypot(info.offset.x, info.offset.y) > 4) draggedRef.current = true;
                        }}
                        onDragEnd={(_e, info) => handleDragEnd(r, info)}
                        onClick={() => {
                          if (draggedRef.current) return;
                          openDetail(r);
                        }}
                        className="surface-panel cursor-grab select-none rounded-lg border border-white/8 p-2.5 active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <SeverityBadge severity={r.analysis.severity} />
                          <span className="font-mono text-[10px] text-slate-600">#{r.id.slice(0, 5)}</span>
                        </div>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-100">
                          <span className="line-clamp-2">{PROBLEM_TYPE_LABELS[r.analysis.problemType]}</span>
                          {linkedLookup.has(r.id) && (
                            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-400">
                              <Link2 size={9} />+{linkedLookup.get(r.id)!.length}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-500">{r.location}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">{relativeTime(r.createdAt)}</span>
                          <select
                            value={r.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(r.id, e.target.value as ReportStatus);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label="تغيير الحالة"
                            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s} className="bg-ink-800">
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </LayoutGroup>
        )}
      </div>

      <SlideOver
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? PROBLEM_TYPE_LABELS[selected.analysis.problemType] : ""}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 border-b border-white/8 pb-3">
              {(
                [
                  { key: "summary", label: "الملخص", icon: FileText },
                  { key: "evidence", label: "الدليل", icon: ImageIcon },
                  { key: "history", label: "السجل", icon: History },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tab === t.key ? "bg-accent-500 text-white" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "summary" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selected.analysis.severity} />
                  <span className="text-slate-600">·</span>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-200">
                  {selected.description || "لا يوجد وصف"}
                </p>
                <div className="space-y-2 text-sm">
                  <Row label="الموقع" value={selected.location || "بدون موقع"} />
                  <Row label="الجهة المسؤولة" value={selected.analysis.department} />
                  <Row label="نسبة الثقة" value={`${Math.round(selected.analysis.confidence * 100)}%`} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400">تغيير الحالة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.map((s) => (
                      <Chip
                        key={s}
                        active={selected.status === s}
                        onClick={() => handleStatusChange(selected.id, s)}
                        dot={STATUS_COLOR[s]}
                      >
                        {STATUS_LABELS[s]}
                      </Chip>
                    ))}
                  </div>
                </div>

                {(linkedLookup.get(selected.id)?.length ?? 0) > 0 && (
                  <div className="space-y-2 border-t border-white/8 pt-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-400">
                      <Link2 size={12} />
                      الـ AI ربط البلاغ ده بـ {linkedLookup.get(selected.id)!.length} بلاغ تاني
                    </p>
                    {linkedLookup.get(selected.id)!.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => openDetail(r)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-2 text-start transition hover:bg-white/[0.06]"
                      >
                        <img src={r.imageDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">
                            {r.description || PROBLEM_TYPE_LABELS[r.analysis.problemType]}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">{relativeTime(r.createdAt)}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "evidence" && (
              <div className="space-y-3">
                <img
                  src={selected.imageDataUrl}
                  alt={PROBLEM_TYPE_LABELS[selected.analysis.problemType]}
                  className="w-full rounded-xl border border-white/10 object-cover"
                />
                <p className="text-xs text-slate-500">
                  تم رفعها {relativeTime(selected.createdAt)} — تحليل الـ AI: {selected.analysis.summary}
                </p>
              </div>
            )}

            {tab === "history" && <ActivityFeed items={historyItems} />}
          </div>
        )}
      </SlideOver>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}
