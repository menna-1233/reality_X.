import type { LucideIcon } from "lucide-react";

export interface ActivityItem {
  icon: LucideIcon;
  title: string;
  time: string;
  tone?: "critical" | "success" | "default";
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-500">لا يوجد نشاط بعد</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg p-2 transition hover:bg-white/[0.03]">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              item.tone === "critical"
                ? "bg-severity-critical/15 text-severity-critical"
                : item.tone === "success"
                  ? "bg-severity-low/15 text-severity-low"
                  : "bg-white/8 text-slate-400"
            }`}
          >
            <item.icon size={12} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{item.title}</p>
            <p className="text-[10px] text-slate-500">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
