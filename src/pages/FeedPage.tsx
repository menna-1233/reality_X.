import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { ReportCard } from "../components/ReportCard";
import { ReportDetailPanel } from "../components/ReportDetailPanel";
import { listReports } from "../lib/storage";
import type { Report } from "../types";

export function FeedPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setReports(listReports());
  }, []);

  function openReport(report: Report) {
    setSelected(report);
    setDrawerOpen(true);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-mist-100">كل البلاغات</h1>
        <p className="text-sm text-mist-500">
          كل بلاغ هنا اتحلل بالـ AI ووصل لإدارة الكمباوند تلقائيًا.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-16 text-mist-500">
          <Inbox size={32} />
          <p>لسه مفيش بلاغات، جرّب ترسل بلاغ جديد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onOpen={openReport} />
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <ReportDetailPanel report={selected} onClose={() => setDrawerOpen(false)} />
        )}
      </Drawer>
    </div>
  );
}
