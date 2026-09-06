import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { ReportCard } from "../components/ReportCard";
import { listReports } from "../lib/storage";
import type { Report } from "../types";

export function FeedPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    setReports(listReports());
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">كل البلاغات</h1>
        <p className="text-sm text-slate-500">
          كل بلاغ هنا اتحلل بالـ AI ووصل لإدارة الكمباوند تلقائيًا.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-slate-400">
          <Inbox size={32} />
          <p>لسه مفيش بلاغات، جرّب ترسل بلاغ جديد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
