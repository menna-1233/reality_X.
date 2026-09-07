import { Loader2, MapPin, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { PhotoDropzone } from "../components/PhotoDropzone";
import { addReport } from "../lib/storage";
import type { Report } from "../types";
import { PROBLEM_TYPE_LABELS, SEVERITY_LABELS } from "../types";

type Status = "idle" | "analyzing" | "done";

export function ReportPage() {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [locating, setLocating] = useState(false);
  const [lastReport, setLastReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocation("الموقع غير متاح على هذا الجهاز");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(
          `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        );
        setLocating(false);
      },
      () => {
        setLocation("تعذر تحديد الموقع");
        setLocating(false);
      },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!imageFile) {
      setError("من فضلك أضف صورة توضح المشكلة");
      return;
    }
    setStatus("analyzing");
    try {
      // The backend does the AI analysis + incident grouping and returns the
      // finished report — no client-side mock step anymore.
      const report = await addReport({ imageFile, description, location });
      setLastReport(report);
      setStatus("done");
    } catch {
      setError("حدث خطأ أثناء إرسال البلاغ، تأكد من اتصال الباك إند وحاول مرة أخرى");
      setStatus("idle");
    }
  }

  function reset() {
    setImageFile(null);
    setDescription("");
    setLocation("");
    setLastReport(null);
    setStatus("idle");
  }

  if (status === "done" && lastReport) {
    return (
      <AppShell title="نتيجة التحليل" breadcrumbs={["بلّغ"]}>
        <div className="mx-auto max-w-lg space-y-4">
          <div className="surface-panel rounded-xl border border-accent-400/20 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-400">
              <Sparkles size={16} /> نتيجة تحليل الـ AI (نتيجة تجريبية للعرض)
            </p>
          </div>
          <div className="surface-panel overflow-hidden rounded-xl border border-white/8">
            <img
              src={lastReport.imageDataUrl}
              alt="صورة البلاغ"
              className="h-48 w-full object-cover"
            />
            <div className="space-y-3 p-4">
              <Row label="نوع المشكلة" value={typeLabel(lastReport)} />
              <Row label="درجة الخطورة" value={severityLabel(lastReport)} />
              <Row label="الجهة المسؤولة" value={lastReport.analysis.department} />
              <Row
                label="نسبة الثقة"
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
              بلاغ جديد
            </button>
            <button
              onClick={() => navigate("/feed")}
              className="flex-1 rounded-lg bg-accent-500 py-2.5 font-medium text-white"
            >
              عرض كل البلاغات
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="بلّغ عن مشكلة" breadcrumbs={["بلّغ"]}>
      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-slate-400">
          صوّر المشكلة وسيقوم الـ AI بتحديد نوعها وخطورتها والجهة المسؤولة تلقائيًا.
        </p>

        <PhotoDropzone value={imageFile} onChange={setImageFile} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">وصف المشكلة</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="مثال: في تسريب مياه جنب المدخل الرئيسي"
            className="surface-panel w-full rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">الموقع</label>
          <div className="flex gap-2">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: عمارة 5 - الحديقة الخلفية"
              className="surface-panel flex-1 rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex items-center gap-1 rounded-lg border border-accent-400/30 px-3 text-sm font-medium text-accent-400 disabled:opacity-60"
            >
              {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
              موقعي
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
              <Loader2 size={18} className="animate-spin" /> الـ AI بيحلل الصورة...
            </>
          ) : (
            <>
              <Send size={18} /> إرسال البلاغ
            </>
          )}
        </button>
      </form>
    </AppShell>
  );
}

function typeLabel(report: Report) {
  return PROBLEM_TYPE_LABELS[report.analysis.problemType];
}
function severityLabel(report: Report) {
  return SEVERITY_LABELS[report.analysis.severity];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}
