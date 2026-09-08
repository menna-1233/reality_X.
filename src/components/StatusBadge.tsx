import { useTranslation } from "react-i18next";
import { statusLabel } from "../lib/labels";
import type { ReportStatus } from "../types";

const COLOR: Record<ReportStatus, string> = {
  open: "var(--color-status-open)",
  in_progress: "var(--color-status-progress)",
  resolved: "var(--color-status-resolved)",
  closed: "var(--color-status-closed)",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: COLOR[status] }}
        aria-hidden="true"
      />
      {statusLabel(t, status)}
    </span>
  );
}
