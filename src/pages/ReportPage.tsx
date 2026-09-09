import { Loader2, MapPin, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { PhotoDropzone } from "../components/PhotoDropzone";
import { parseLatLng, reverseGeocode } from "../lib/geo";
import { departmentLabel, problemTypeLabel, severityLabel } from "../lib/labels";
import { addReport } from "../lib/storage";
import type { Report } from "../types";

type Status = "idle" | "analyzing" | "done";

export function ReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  // Numeric coordinates from "use my location", tracked separately from the
  // `location` display text — that text gets overwritten with a readable
  // address once reverse geocoding resolves (see useMyLocation below), and
  // without this the coordinates were lost entirely: the backend never
  // received them, so the report couldn't be plotted on the dashboard map.
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [locating, setLocating] = useState(false);
  const [lastReport, setLastReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocation(t("reportPage.locationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords([latitude, longitude]);
        // Show coordinates immediately, then swap in the readable address
        // once reverse-geocoding resolves (or keep the coordinates on failure).
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        const address = await reverseGeocode(latitude, longitude);
        if (address) setLocation(address);
        setLocating(false);
      },
      () => {
        setCoords(null);
        setLocation(t("reportPage.locationFailed"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!imageFile) {
      setError(t("reportPage.imageRequiredError"));
      return;
    }
    if (!description.trim()) {
      setError(t("reportPage.descriptionRequiredError"));
      return;
    }
    if (!location.trim()) {
      setError(t("reportPage.locationRequiredError"));
      return;
    }
    setStatus("analyzing");
    try {
      // The backend does the AI analysis + incident grouping and returns the
      // finished report — no client-side mock step anymore.
      const report = await addReport({
        imageFile,
        description,
        location,
        latitude: coords?.[0] ?? null,
        longitude: coords?.[1] ?? null,
      });
      setLastReport(report);
      setStatus("done");
    } catch {
      setError(t("reportPage.submitError"));
      setStatus("idle");
    }
  }

  function reset() {
    setImageFile(null);
    setDescription("");
    setLocation("");
    setCoords(null);
    setLastReport(null);
    setStatus("idle");
  }

  if (status === "done" && lastReport) {
    return (
      <AppShell title={t("reportPage.resultTitle")}>
        <div className="mx-auto max-w-lg space-y-4">
          <div className="surface-panel rounded-xl border border-accent-400/20 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-400">
              <Sparkles size={16} /> {t("reportPage.resultBadge")}
            </p>
          </div>
          <div className="surface-panel overflow-hidden rounded-xl border border-white/8">
            <img
              src={lastReport.imageDataUrl}
              alt={t("reportPage.reportImageAlt")}
              className="h-48 w-full object-cover"
            />
            <div className="space-y-3 p-4">
              <Row label={t("reportPage.rowType")} value={problemTypeLabel(t, lastReport.analysis.problemType)} />
              <Row label={t("reportPage.rowSeverity")} value={severityLabel(t, lastReport.analysis.severity)} />
              <Row label={t("common.department")} value={departmentLabel(t, lastReport.analysis.problemType)} />
              <Row
                label={t("common.confidence")}
                value={`${Math.round(lastReport.analysis.confidence * 100)}%`}
              />
              <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-300">
                {lastReport.analysis.summary}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 rounded-lg border border-accent-400/30 py-2.5 font-medium text-accent-400"
            >
              {t("nav.newReport")}
            </button>
            <button
              onClick={() => navigate("/feed")}
              className="flex-1 rounded-lg bg-accent-500 py-2.5 font-medium text-white"
            >
              {t("reportPage.viewAllReports")}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("reportPage.title")}>
      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-slate-400">{t("reportPage.subtitle")}</p>

        <PhotoDropzone value={imageFile} onChange={setImageFile} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            {t("reportPage.descriptionLabel")} <span className="text-severity-critical">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder={t("reportPage.descriptionPlaceholder")}
            className="surface-panel w-full rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">
            {t("reportPage.locationLabel")} <span className="text-severity-critical">*</span>
          </label>
          <div className="flex gap-2">
            <input
              value={location}
              onChange={(e) => {
                const value = e.target.value;
                setLocation(value);
                // Editing by hand invalidates any coordinates captured via
                // "use my location" — unless what they typed is itself a
                // "lat, lon" pair, keep recognizing that too.
                setCoords(parseLatLng(value));
              }}
              required
              placeholder={t("reportPage.locationPlaceholder")}
              className="surface-panel flex-1 rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex items-center gap-1 rounded-lg border border-accent-400/30 px-3 text-sm font-medium text-accent-400 disabled:opacity-60"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              {t("reportPage.useMyLocation")}
            </button>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-severity-critical">{error}</p>}

        <button
          type="submit"
          disabled={status === "analyzing"}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 py-3 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-70"
        >
          {status === "analyzing" ? (
            <>
              <Loader2 size={18} className="animate-spin" /> {t("reportPage.analyzing")}
            </>
          ) : (
            <>
              <Send size={18} /> {t("reportPage.submit")}
            </>
          )}
        </button>
      </form>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}
