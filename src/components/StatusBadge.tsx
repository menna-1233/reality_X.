import type { ReportStatus } from "../types";
import { STATUS_LABELS } from "../types";

const STYLES: Record<ReportStatus, string> = {
  open: "bg-status-open/15 text-status-open ring-1 ring-inset ring-status-open/30",
  in_progress:
    "bg-status-progress/15 text-yellow-300 ring-1 ring-inset ring-status-progress/40",
  resolved:
    "bg-status-resolved/15 text-status-resolved ring-1 ring-inset ring-status-resolved/30",
  closed: "bg-status-closed/15 text-slate-300 ring-1 ring-inset ring-status-closed/40",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}
