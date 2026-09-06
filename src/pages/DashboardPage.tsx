import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Bell, Clock3, MapPinOff, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "../components/Sparkline";
import { parseLatLng } from "../lib/geo";
import { listReports } from "../lib/storage";
import type { Report, Severity } from "../types";
import { PROBLEM_TYPE_LABELS, SEVERITY_LABELS } from "../types";

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const DEFAULT_CENTER: [number, number] = [30.0596, 31.2295]; // fallback: Cairo-area compound

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

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="glass-panel rounded-xl border border-white/10 px-3 py-2.5">
      <p className="font-mono text-xl font-bold" style={{ color: tone ?? "#fff" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

export function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    setReports(listReports());
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(reports.map((r) => r.analysis.department))),
    [reports],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (dept !== "all" && r.analysis.department !== dept) return false;
      if (!q) return true;
      const hay = `${r.description} ${r.location} ${PROBLEM_TYPE_LABELS[r.analysis.problemType]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, search, dept]);

  const total = filtered.length;
  const openCount = filtered.filter((r) => r.status === "open" || r.status === "in_progress").length;
  const criticalCount = filtered.filter((r) => r.analysis.severity === "critical").length;
  const resolvedCount = filtered.filter((r) => r.status === "resolved").length;

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

  const avgOpenAgeLabel = useMemo(() => {
    const open = filtered.filter((r) => r.status === "open" || r.status === "in_progress");
    if (open.length === 0) return "—";
    const avgMs =
      open.reduce((sum, r) => sum + (Date.now() - new Date(r.createdAt).getTime()), 0) / open.length;
    const hours = avgMs / 3600000;
    return hours < 24 ? `${hours.toFixed(1)} ساعة` : `${(hours / 24).toFixed(1)} يوم`;
  }, [filtered]);

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
    () => filtered.filter((r) => !parseLatLng(r.location)).length,
    [filtered],
  );

  const recent = useMemo(() => filtered.slice(0, 4), [filtered]);

  // init map once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
      className: "map-tiles-dark",
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
      const latLng = parseLatLng(r.location);
      if (!latLng) continue;
      coords.push(latLng);
      L.circleMarker(latLng, {
        radius: 9,
        color: "#0b0f16",
        weight: 2,
        fillColor: SEVERITY_COLOR[r.analysis.severity],
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<div style="font-family:Cairo,sans-serif;direction:rtl;min-width:160px">` +
            `<b>${PROBLEM_TYPE_LABELS[r.analysis.problemType]}</b><br/>` +
            `<span style="color:#64748b;font-size:12px">${r.location}</span><br/>` +
            `<span style="font-size:12px">${SEVERITY_LABELS[r.analysis.severity]} · ${relativeTime(r.createdAt)}</span>` +
            `</div>`,
        )
        .addTo(layer);
    }
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView(DEFAULT_CENTER, 15);
    }
  }, [filtered]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 lg:px-6">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setDept("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              dept === "all" ? "bg-white text-ink-950" : "glass-panel border border-white/10 text-slate-300"
            }`}
          >
            كل البلاغات
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                dept === d ? "bg-white text-ink-950" : "glass-panel border border-white/10 text-slate-300"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="glass-panel flex min-w-[220px] items-center gap-2 rounded-full border border-white/10 px-3.5 py-2">
          <Search size={15} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في البلاغات..."
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>
        <button className="glass-panel relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-300">
          <Bell size={16} />
          {criticalAlerts.length > 0 && (
            <span className="absolute -top-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-severity-critical font-mono text-[10px] font-bold text-white">
              {criticalAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_300px]">
        {/* left rail */}
        <div className="space-y-3 lg:order-1">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="إجمالي البلاغات" value={total} />
            <StatTile label="مفتوحة" value={openCount} tone="#3cc0ff" />
            <StatTile label="حرجة" value={criticalCount} tone="#ef4444" />
            <StatTile label="تم حلها" value={resolvedCount} tone="#22c55e" />
          </div>

          <div className="glass-panel rounded-xl border border-white/10 p-3.5">
            <p className="text-[11px] text-slate-400">متوسط عمر البلاغات المفتوحة</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white">{avgOpenAgeLabel}</p>
            <div className="mt-2">
              <Sparkline values={trend} color="#3cc0ff" />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">بلاغات جديدة آخر ٧ أيام</p>
          </div>

          <div className="glass-panel space-y-2 rounded-xl border border-white/10 p-3">
            <p className="text-[11px] font-semibold text-slate-400">أحدث البلاغات</p>
            {recent.map((r) => (
              <Link
                key={r.id}
                to={`/reports/${r.id}`}
                className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/5"
              >
                <img src={r.imageDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">
                    {PROBLEM_TYPE_LABELS[r.analysis.problemType]}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{relativeTime(r.createdAt)}</p>
                </div>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SEVERITY_COLOR[r.analysis.severity] }}
                />
              </Link>
            ))}
            {recent.length === 0 && <p className="py-3 text-center text-xs text-slate-500">لا توجد بلاغات</p>}
          </div>
        </div>

        {/* map */}
        <div className="glass-panel relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 lg:order-2">
          <div ref={mapElRef} className="h-full min-h-[420px] w-full" />
          {unmappedCount > 0 && (
            <div className="glass-panel pointer-events-none absolute bottom-3 start-3 flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-slate-300">
              <MapPinOff size={13} />
              {unmappedCount} بلاغ بدون إحداثيات دقيقة
            </div>
          )}
        </div>

        {/* right rail */}
        <div className="space-y-3 lg:order-3">
          <div className="glass-panel rounded-xl border border-severity-critical/25 bg-severity-critical/[0.04] p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <AlertTriangle size={13} className="text-severity-critical" />
              بلاغات حرجة مفتوحة ({criticalAlerts.length})
            </p>
            <div className="space-y-2">
              {criticalAlerts.map((r) => (
                <Link
                  key={r.id}
                  to={`/reports/${r.id}`}
                  className="block rounded-lg border-s-2 border-severity-critical bg-white/5 p-2 transition hover:bg-white/10"
                >
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {PROBLEM_TYPE_LABELS[r.analysis.problemType]}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {r.location} · {relativeTime(r.createdAt)}
                  </p>
                </Link>
              ))}
              {criticalAlerts.length === 0 && (
                <p className="py-2 text-center text-xs text-slate-500">مفيش بلاغات حرجة مفتوحة دلوقتي 👍</p>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl border border-white/10 p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <Clock3 size={13} />
              البلاغات حسب نوع المشكلة
            </p>
            <div className="space-y-1.5">
              {byType.map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 truncate text-slate-400">
                    {PROBLEM_TYPE_LABELS[type as keyof typeof PROBLEM_TYPE_LABELS]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-400"
                      style={{ width: `${(count! / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 shrink-0 text-end font-mono text-slate-500">{count}</span>
                </div>
              ))}
              {byType.length === 0 && <p className="py-2 text-center text-xs text-slate-500">لا توجد بيانات</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
