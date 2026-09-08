import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Inbox,
  Loader2,
  MapPinOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { AppShell } from "../components/AppShell";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { Gauge } from "../components/Gauge";
import { Sparkline } from "../components/Sparkline";
import { StatTile } from "../components/StatTile";
import { apiExportReportsExcel } from "../lib/api";
import { groupIntoIncidents } from "../lib/incidents";
import { departmentLabel, eventLabel, problemTypeLabel, severityLabel, statusLabel } from "../lib/labels";
import { listRecentEvents, listReports } from "../lib/storage";
import { formatRelativeTime } from "../lib/time";
import type { ProblemType, Report, Severity } from "../types";

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f59e0b",
  critical: "#ef4444",
};

const DEFAULT_CENTER: [number, number] = [30.0596, 31.2295]; // fallback: Cairo-area compound

/** Real numeric coordinates, when the report has them — not a parse of the display string. */
function reportCoords(r: Report): [number, number] | null {
  return r.latitude != null && r.longitude != null ? [r.latitude, r.longitude] : null;
}

/**
 * Resolution-rate gauge color, on plain round thresholds: below 40% is bad
 * (critical/red), 40-69% is middling (medium/amber), 70%+ is healthy
 * (low/green). Reuses the existing severity tokens rather than inventing
 * new colors — never accent, per this codebase's severity-color convention.
 */
function resolutionGaugeColor(pct: number): string {
  if (pct < 40) return "var(--color-severity-critical)";
  if (pct < 70) return "var(--color-severity-medium)";
  return "var(--color-severity-low)";
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    listReports().then(setReports).catch(() => setReports([]));
  }, []);

  // The responsible department is always a deterministic function of the
  // problem type (see departmentLabel in lib/labels.ts) — grouping and
  // filtering by problemType (rather than the raw, possibly differently-
  // worded-per-language `analysis.department` string stored on the report)
  // keeps this correct across languages and for reports created before a
  // language-aware backend existed.
  const departments = useMemo(
    () => Array.from(new Set(reports.map((r) => r.analysis.problemType))),
    [reports],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (dept !== "all" && r.analysis.problemType !== dept) return false;
      if (!q) return true;
      const hay = `${r.description} ${r.location} ${problemTypeLabel(t, r.analysis.problemType)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, search, dept, t]);

  const total = filtered.length;
  const criticalCount = filtered.filter((r) => r.analysis.severity === "critical").length;
  const resolvedCount = filtered.filter((r) => r.status === "resolved").length;
  const resolutionRate = total > 0 ? (resolvedCount / total) * 100 : 0;
  const linkedGroupsCount = useMemo(
    () => groupIntoIncidents(filtered).filter((i) => i.reports.length > 1).length,
    [filtered],
  );

  const trend = useMemo(() => {
    const days = 7;
    const buckets = Array(days).fill(0);
    const now = Date.now();
    for (const r of filtered) {
      const ageDays = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000);
      if (ageDays >= 0 && ageDays < days) buckets[days - 1 - ageDays]++;
    }
    return buckets;
  }, [filtered]);

  // only show a "vs last week" delta when there's enough real spread to make one meaningful
  const trendDelta = useMemo(() => {
    const older = trend.slice(0, 4).reduce((a, b) => a + b, 0);
    const newer = trend.slice(4).reduce((a, b) => a + b, 0);
    if (older === 0) return undefined;
    return Math.round(((newer - older) / older) * 100);
  }, [trend]);

  const avgOpenAgeLabel = useMemo(() => {
    const open = filtered.filter((r) => r.status === "open" || r.status === "in_progress");
    if (open.length === 0) return "—";
    const avgMs =
      open.reduce((sum, r) => sum + (Date.now() - new Date(r.createdAt).getTime()), 0) / open.length;
    const hours = avgMs / 3600000;
    return hours < 24
      ? t("dashboardPage.hoursUnit", { value: hours.toFixed(1) })
      : t("dashboardPage.daysUnit", { value: (hours / 24).toFixed(1) });
  }, [filtered, t]);

  const byType = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const r of filtered) {
      counts[r.analysis.problemType] = (counts[r.analysis.problemType] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1]! - a[1]!);
  }, [filtered]);

  const criticalAlerts = useMemo(
    () =>
      filtered
        .filter((r) => r.analysis.severity === "critical" && r.status !== "resolved" && r.status !== "closed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [filtered],
  );

  const unmappedCount = useMemo(
    () => filtered.filter((r) => !reportCoords(r)).length,
    [filtered],
  );

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await apiExportReportsExcel();
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const recentEvents = useMemo(() => listRecentEvents(reports, 6), [reports]);
  const activityItems = recentEvents.map(({ report, event }) => ({
    icon: event.kind === "status_changed" ? RefreshCw : event.kind === "analyzed" ? CheckCircle2 : Inbox,
    title: `${problemTypeLabel(t, report.analysis.problemType)} — ${eventLabel(t, event.kind)}`,
    time: formatRelativeTime(event.at, t),
    tone:
      event.kind === "status_changed" && report.status === "resolved"
        ? ("success" as const)
        : report.analysis.severity === "critical"
          ? ("critical" as const)
          : ("default" as const),
  }));

  // init map once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 15);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // update markers when filtered reports change
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const coords: [number, number][] = [];
    for (const r of filtered) {
      const latLng = reportCoords(r);
      if (!latLng) continue;
      coords.push(latLng);

      // heat halo for critical reports, echoing the reference's radiating threat-map blobs
      if (r.analysis.severity === "critical") {
        L.circleMarker(latLng, {
          radius: 22,
          stroke: false,
          fillColor: "#f0552a",
          fillOpacity: 0.16,
        }).addTo(layer);
      }

      const dir = i18n.dir();
      L.circleMarker(latLng, {
        radius: 8,
        color: "#14110f",
        weight: 2,
        fillColor: SEVERITY_COLOR[r.analysis.severity],
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="font-family:Cairo,sans-serif;direction:${dir};min-width:160px">` +
            `<b>${problemTypeLabel(t, r.analysis.problemType)}</b><br/>` +
            `<span style="color:#94a3b8;font-size:12px">${r.location}</span><br/>` +
            `<span style="font-size:12px">${severityLabel(t, r.analysis.severity)} · ${formatRelativeTime(r.createdAt, t)}</span>` +
            `</div>`,
        )
        .addTo(layer);
    }
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView(DEFAULT_CENTER, 15);
    }
    // i18n.language (not just t, whose identity is stable across languages) triggers a
    // rebuild so popup labels + text direction follow a language switch.
  }, [filtered, t, i18n, i18n.language]);

  return (
    <AppShell
      title={t("nav.overview")}
      actions={
        <>
          <div className="surface-panel flex min-w-[220px] items-center gap-2 rounded-lg border border-white/8 px-3.5 py-2">
            <Search size={15} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.searchPlaceholder")}
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="surface-panel flex items-center gap-1.5 rounded-lg border border-white/8 px-3.5 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {t("dashboardPage.exportExcel", { defaultValue: "تحميل Excel" })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Chip active={dept === "all"} onClick={() => setDept("all")}>
            {t("common.allReports")}
          </Chip>
          {departments.map((d) => (
            <Chip key={d} active={dept === d} onClick={() => setDept(d)} title={departmentLabel(t, d)}>
              {departmentLabel(t, d)}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_300px]">
          {/* left rail */}
          <div className="space-y-3 lg:order-1">
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label={t("dashboardPage.statTotal")}
                value={total}
                delta={trendDelta}
                deltaGoodDirection="down"
              />
              <StatTile
                label={t("dashboardPage.statLinked")}
                labelHint={t("dashboardPage.statLinkedCaption")}
                value={linkedGroupsCount}
              />
              <StatTile label={severityLabel(t, "critical")} value={criticalCount} tone="critical" />
              <StatTile label={statusLabel(t, "resolved")} value={resolvedCount} tone="success" />
            </div>

            <div className="surface-panel flex items-center gap-3 rounded-xl border border-white/8 p-3.5">
              <Gauge pct={resolutionRate} color={resolutionGaugeColor(resolutionRate)} />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400">{t("dashboardPage.resolutionRate")}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{t("dashboardPage.resolutionRateCaption")}</p>
              </div>
            </div>

            <div className="surface-panel rounded-xl border border-white/8 p-3.5">
              <p className="text-[11px] text-slate-400">{t("dashboardPage.avgOpenAge")}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-white">{avgOpenAgeLabel}</p>

              <div className="mt-3 border-t border-white/8 pt-3">
                <p className="text-[10px] text-slate-500">{t("dashboardPage.trendCaption")}</p>
                <div className="mt-1.5">
                  <Sparkline values={trend} color="var(--color-accent-400)" variant="bar" />
                </div>
              </div>
            </div>

            <div className="surface-panel space-y-1 rounded-xl border border-white/8 p-3">
              <p className="mb-1 px-1 text-[11px] font-semibold text-slate-400">{t("dashboardPage.recentActivity")}</p>
              <ActivityFeed items={activityItems} />
            </div>
          </div>

          {/* map */}
          <div className="surface-panel relative min-h-[420px] overflow-hidden rounded-xl border border-white/8 lg:order-2">
            <div ref={mapElRef} className="h-full min-h-[420px] w-full" />
            {unmappedCount > 0 && (
              <div className="surface-panel pointer-events-none absolute bottom-3 start-3 flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-slate-300">
                <MapPinOff size={13} />
                {unmappedCount} {t("dashboardPage.unmappedSuffix")}
              </div>
            )}
            <div className="surface-panel pointer-events-none absolute top-3 end-3 space-y-1 rounded-lg border border-white/10 px-2.5 py-2">
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
                  {severityLabel(t, s)}
                </div>
              ))}
            </div>
          </div>

          {/* right rail */}
          <div className="space-y-3 lg:order-3">
            <div className="surface-panel rounded-xl border border-severity-critical/20 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <AlertTriangle size={13} className="text-severity-critical" />
                {t("dashboardPage.openCriticalAlerts")} ({criticalAlerts.length})
              </p>
              {criticalAlerts.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-500">{t("dashboardPage.noCriticalAlerts")}</p>
              ) : (
                <div className="space-y-2">
                  {criticalAlerts.map((r) => (
                    <Link
                      key={r.id}
                      to={`/reports/${r.id}`}
                      className="block rounded-lg border-s-2 border-severity-critical bg-white/5 p-2 transition hover:bg-white/10"
                    >
                      <p className="truncate text-xs font-semibold text-slate-100">
                        {problemTypeLabel(t, r.analysis.problemType)}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {r.location} · {formatRelativeTime(r.createdAt, t)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="surface-panel rounded-xl border border-white/8 p-3.5">
              <p className="mb-2 text-[11px] font-semibold text-slate-400">{t("dashboardPage.byType")}</p>
              {byType.length === 0 ? (
                <EmptyState icon={Inbox} title={t("common.noData")} />
              ) : (
                <div className="space-y-1.5">
                  {byType.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="w-20 shrink-0 truncate text-slate-400"
                        title={problemTypeLabel(t, type as ProblemType)}
                      >
                        {problemTypeLabel(t, type as ProblemType)}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent-500"
                          style={{ width: `${(count! / total) * 100}%` }}
                        />
                      </div>
                      <span className="w-4 shrink-0 text-end font-mono text-slate-500">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
