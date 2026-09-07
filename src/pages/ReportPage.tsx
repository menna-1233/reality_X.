import { Loader2, MapPin, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhotoDropzone } from "../components/PhotoDropzone";
import { mockAnalyze } from "../lib/mockAnalyze";
import { addReport } from "../lib/storage";
import type { Report } from "../types";
import { PROBLEM_TYPE_LABELS, SEVERITY_LABELS } from "../types";

type Status = "idle" | "analyzing" | "done";

export function ReportPage() {
  const navigate = useNavigate();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
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
    if (!imageDataUrl) {
      setError("من فضلك أضف صورة توضح المشكلة");
      return;
    }
    setStatus("analyzing");
    try {
      const analysis = await mockAnalyze(description);
      const report: Report = {
        id: crypto.randomUUID(),
        imageDataUrl,
        description,
        location,
        createdAt: new Date().toISOString(),
        analysis,
      };
      addReport(report);
      setLastReport(report);
      setStatus("done");
    } catch {
      setError("حدث خطأ أثناء تحليل البلاغ، حاول مرة أخرى");
      setStatus("idle");
    }
  }

  function reset() {
    setImageDataUrl(null);
    setDescription("");
    setLocation("");
    setLastReport(null);
    setStatus("idle");
  }

  if (status === "done" && lastReport) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div className="rounded-2xl border border-ember-500/25 bg-ember-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ember-300">
            <Sparkles size={16} /> نتيجة تحليل الـ AI (نتيجة تجريبية للعرض)
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl">
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
            <p className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-mist-300">
              {lastReport.analysis.summary}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 rounded-xl border border-ember-500/30 py-2.5 font-medium text-ember-300 transition hover:bg-ember-500/10"
          >
            بلاغ جديد
          </button>
          <button
            onClick={() => navigate("/feed")}
            className="flex-1 rounded-xl bg-ember-500 py-2.5 font-medium text-ink-950 transition hover:bg-ember-400"
          >
            عرض كل البلاغات
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-mist-100">بلّغ عن مشكلة</h1>
        <p className="text-sm text-mist-500">
          صوّر المشكلة وسيقوم الـ AI بتحديد نوعها وخطورتها والجهة المسؤولة تلقائيًا.
        </p>
      </div>

      <PhotoDropzone imageDataUrl={imageDataUrl} onChange={setImageDataUrl} />

      <div className="space-y-1">
        <label className="text-sm font-medium text-mist-300">وصف المشكلة</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="مثال: في تسريب مياه جنب المدخل الرئيسي"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-mist-300">الموقع</label>
        <div className="flex gap-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="مثال: عمارة 5 - الحديقة الخلفية"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-ember-500/50 focus:ring-2 focus:ring-ember-500/20"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-1 rounded-xl border border-ember-500/30 px-3 text-sm font-medium text-ember-300 transition hover:bg-ember-500/10 disabled:opacity-60"
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ember-500 py-3 font-semibold text-ink-950 transition hover:bg-ember-400 disabled:opacity-70"
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
      <span className="text-mist-500">{label}</span>
      <span className="font-semibold text-mist-100">{value}</span>
    </div>
  );
}
