import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ReportDetailPanel } from "../components/ReportDetailPanel";
import { getReport } from "../lib/storage";
import type { Report } from "../types";

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null | undefined>(undefined);

  useEffect(() => {
    setReport(id ? getReport(id) ?? null : null);
  }, [id]);

  if (report === undefined) return null;

  if (report === null) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10 text-center text-mist-500">
        <p>البلاغ غير موجود</p>
        <Link to="/feed" className="text-ember-400 underline">
          الرجوع لكل البلاغات
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
      <div className="absolute inset-y-0 right-0 w-full max-w-md">
        <ReportDetailPanel report={report} onClose={() => navigate("/feed")} />
      </div>
    </div>
  );
}
