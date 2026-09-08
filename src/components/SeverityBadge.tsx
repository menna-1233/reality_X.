import { useTranslation } from "react-i18next";
import { severityLabel } from "../lib/labels";
import type { Severity } from "../types";

const COLOR: Record<Severity, string> = {
  low: "var(--color-severity-low)",
  medium: "var(--color-severity-medium)",
  high: "var(--color-severity-high)",
  critical: "var(--color-severity-critical)",
};

const BARS_ON: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 2,
  critical: 3,
};

function SeverityMeter({ severity }: { severity: Severity }) {
  const on = BARS_ON[severity];
  const color = COLOR[severity];
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: `${5 + i * 3}px`,
            background: i < on ? color : "rgba(255,255,255,0.14)",
          }}
        />
      ))}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: COLOR[severity] }}
    >
      <SeverityMeter severity={severity} />
      {severityLabel(t, severity)}
    </span>
  );
}
