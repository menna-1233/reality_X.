import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/12 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10 text-accent-400">
        <Icon size={22} />
      </span>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {action}
    </div>
  );
}
