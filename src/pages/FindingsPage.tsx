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
import { useTranslation } from "react-i18next";
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
import { departmentLabel, eventLabel, problemTypeLabel, severityLabel, statusLabel } from "../lib/labels";
import { listReports, setReportStatus } from "../lib/storage";
import { formatRelativeTime } from "../lib/time";
import type { Report, ReportStatus, Severity } from "../types";

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

interface DragPoint {
  point: { x: number; y: number };
}

export function FindingsPage() {
  const { t, i18n } = useTranslation();
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
    listReports().then(setReports).catch(() => setReports([]));
  }
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (filters.severity !== "all" && r.analysis.severity !== filters.severity) return false;
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (!q) return true;
      const hay =
        `${r.description} ${r.location} ${problemTypeLabel(t, r.analysis.problemType)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, filters, search, t]);

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

  async function handleStatusChange(id: string, status: ReportStatus) {
    await setReportStatus(id, status);
    const updated = await listReports();
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
      label: t("common.severityLabel"),
      options: [
        { value: "all", label: t("common.all") },
        ...(["critical", "high", "medium", "low"] as Severity[]).map((s) => ({
          value: s,
          label: severityLabel(t, s),
          dot: SEVERITY_COLOR[s],
        })),
      ],
    },
    {
      key: "status",
      label: t("common.statusLabel"),
      options: [
        { value: "all", label: t("common.all") },
        ...STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(t, s), dot: STATUS_COLOR[s] })),
      ],
    },
  ];

  const columns: DataTableColumn<Report>[] = [
    {
      key: "id",
      label: t("findingsPage.colId"),
      render: (r) => <span className="font-mono text-xs text-slate-500">#{r.id.slice(0, 6)}</span>,
    },
    {
      key: "type",
      label: t("findingsPage.colType"),
      render: (r) => {
        const linked = linkedLookup.get(r.id);
        return (
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            {problemTypeLabel(t, r.analysis.problemType)}
            {linked && linked.length > 0 && (
              <span className="flex items-center gap-0.5 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-400">
                <Link2 size={9} />+{linked.length}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "severity",
      label: t("common.severityLabel"),
      render: (r) => <SeverityBadge severity={r.analysis.severity} />,
    },
    { key: "status", label: t("common.statusLabel"), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "dept",
      label: t("findingsPage.colDepartment"),
      render: (r) => <span className="text-xs text-slate-400">{departmentLabel(t, r.analysis.problemType)}</span>,
    },
    {
      key: "confidence",
      label: t("common.confidence"),
      render: (r) => (
        <span className="font-mono text-xs text-slate-400">
          {Math.round(r.analysis.confidence * 100)}%
        </span>
      ),
    },
    {
      key: "date",
      label: t("findingsPage.colDate"),
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">
          {new Date(r.createdAt).toLocaleDateString(i18n.language === "en" ? "en-US" : "ar-EG-u-nu-latn")}
        </span>
      ),
    },
  ];

  const historyItems: ActivityItem[] = (selected?.events ?? [])
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((e) => ({
      icon: e.kind === "status_changed" ? RefreshCw : e.kind === "analyzed" ? CheckCircle2 : Inbox,
      title: eventLabel(t, e.kind),
      time: formatRelativeTime(e.at, t),
    }));

  return (
    <AppShell
      title={t("nav.manageReports")}
      actions={
        <div className="flex items-center gap-2">
          <div className="surface-panel flex items-center rounded-lg border border-white/8 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "kanban" ? "bg-accent-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={14} /> {t("findingsPage.kanban")}
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                view === "table" ? "bg-accent-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Table2 size={14} /> {t("findingsPage.table")}
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
            placeholder={t("common.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t("findingsPage.noMatch")}
            action={
              <button
                onClick={() => {
                  setFilters({ severity: "all", status: "all" });
                  setSearch("");
                }}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
              >
                {t("findingsPage.clearFilters")}
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
                    <p className="text-xs font-semibold text-slate-300">{statusLabel(t, status)}</p>
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
                          <span className="line-clamp-2">{problemTypeLabel(t, r.analysis.problemType)}</span>
                          {linkedLookup.has(r.id) && (
                            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-400">
                              <Link2 size={9} />+{linkedLookup.get(r.id)!.length}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-500">{r.location}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">{formatRelativeTime(r.createdAt, t)}</span>
                          <select
                            value={r.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(r.id, e.target.value as ReportStatus);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label={t("findingsPage.changeStatus")}
                            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s} className="bg-ink-800">
                                {statusLabel(t, s)}
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
        title={selected ? problemTypeLabel(t, selected.analysis.problemType) : ""}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 border-b border-white/8 pb-3">
              {(
                [
                  { key: "summary", labelKey: "findingsPage.tabSummary", icon: FileText },
                  { key: "evidence", labelKey: "findingsPage.tabEvidence", icon: ImageIcon },
                  { key: "history", labelKey: "findingsPage.tabHistory", icon: History },
                ] as const
              ).map((tabDef) => (
                <button
                  key={tabDef.key}
                  onClick={() => setTab(tabDef.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tab === tabDef.key ? "bg-accent-500 text-white" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <tabDef.icon size={13} />
                  {t(tabDef.labelKey)}
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
                  {selected.description || t("findingsPage.noDescription")}
                </p>
                <div className="space-y-2 text-sm">
                  <Row label={t("common.location")} value={selected.location || t("findingsPage.noLocation")} />
                  <Row label={t("common.department")} value={departmentLabel(t, selected.analysis.problemType)} />
                  <Row label={t("common.confidence")} value={`${Math.round(selected.analysis.confidence * 100)}%`} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400">{t("findingsPage.changeStatus")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.map((s) => (
                      <Chip
                        key={s}
                        active={selected.status === s}
                        onClick={() => handleStatusChange(selected.id, s)}
                        dot={STATUS_COLOR[s]}
                      >
                        {statusLabel(t, s)}
                      </Chip>
                    ))}
                  </div>
                </div>

                {(linkedLookup.get(selected.id)?.length ?? 0) > 0 && (
                  <div className="space-y-2 border-t border-white/8 pt-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-400">
                      <Link2 size={12} />
                      {t("findingsPage.linkedNotice", { count: linkedLookup.get(selected.id)!.length })}
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
                            {r.description || problemTypeLabel(t, r.analysis.problemType)}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">{formatRelativeTime(r.createdAt, t)}</p>
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
                  alt={problemTypeLabel(t, selected.analysis.problemType)}
                  className="w-full rounded-xl border border-white/10 object-cover"
                />
                <p className="text-xs text-slate-500">
                  {t("findingsPage.uploadedPrefix")} {formatRelativeTime(selected.createdAt, t)} —{" "}
                  {t("findingsPage.aiAnalysisPrefix")} {selected.analysis.summary}
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
