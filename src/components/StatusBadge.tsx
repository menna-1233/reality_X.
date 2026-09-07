import type { ReportStatus } from "../types";
import { STATUS_LABELS } from "../types";

const COLOR: Record<ReportStatus, string> = {
  open: "var(--color-status-open)",
  in_progress: "var(--color-status-progress)",
  resolved: "var(--color-status-resolved)",
  closed: "var(--color-status-closed)",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: COLOR[status] }}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
