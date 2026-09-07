import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { ReportCard } from "../components/ReportCard";
import { ReportDetailPanel } from "../components/ReportDetailPanel";
import { groupReports } from "../lib/groupReports";
import { listReports } from "../lib/storage";
import type { Report } from "../types";

export function FeedPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Report[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setReports(listReports());
  }, []);

  function openGroup(group: Report[]) {
    setSelectedGroup(group);
    setDrawerOpen(true);
  }

  const groups = groupReports(reports);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-mist-100">كل البلاغات</h1>
        <p className="text-sm text-mist-500">
          كل بلاغ هنا اتحلل بالـ AI ووصل لإدارة الكمباوند تلقائيًا.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-16 text-mist-500">
          <Inbox size={32} />
          <p>لسه مفيش بلاغات، جرّب ترسل بلاغ جديد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <ReportCard
              key={group.key}
              report={group.reports[0]}
              linkedCount={group.reports.length - 1}
              onOpen={() => openGroup(group.reports)}
            />
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selectedGroup.length > 0 && (
          <ReportDetailPanel
            report={selectedGroup[0]}
            linkedReports={selectedGroup.slice(1)}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </Drawer>
    </div>
  );
}
