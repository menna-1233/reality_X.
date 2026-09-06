import type { Severity } from "../types";
import { SEVERITY_LABELS } from "../types";

const STYLES: Record<Severity, string> = {
  low: "bg-severity-low/15 text-severity-low ring-1 ring-inset ring-severity-low/30",
  medium: "bg-severity-medium/15 text-yellow-300 ring-1 ring-inset ring-severity-medium/40",
  high: "bg-severity-high/15 text-severity-high ring-1 ring-inset ring-severity-high/30",
  critical:
    "bg-severity-critical/15 text-severity-critical ring-1 ring-inset ring-severity-critical/30",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[severity]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
