import { ArrowDown, ArrowUp } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function useCountUp(target: number, durationMs = 600) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  // Async data loading (reports arriving after mount) shouldn't animate as if
  // the user watched it count up from zero — only genuine later changes should.
  const pastFirstChangeRef = useRef(false);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;

    if (from === target) {
      setDisplay(target);
      return;
    }
    if (!pastFirstChangeRef.current) {
      pastFirstChangeRef.current = true;
      setDisplay(target);
      return;
    }
    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t); // ease-out quad
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, prefersReduced]);

  return display;
}

export function StatTile({
  label,
  value,
  delta,
  deltaGoodDirection = "down",
  baseline,
  children,
}: {
  label: string;
  value: string | number;
  /** signed percentage change, e.g. 8 or -12 */
  delta?: number;
  /** which direction of change counts as "good" for this metric */
  deltaGoodDirection?: "up" | "down";
  baseline?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const isUp = (delta ?? 0) > 0;
  const isGood = delta === undefined ? null : (isUp ? "up" : "down") === deltaGoodDirection;
  const numeric = typeof value === "number";
  const animatedValue = useCountUp(numeric ? value : 0);
  const resolvedBaseline = baseline ?? t("common.baselineLastWeek");

  return (
    <div className="surface-panel rounded-xl border border-white/8 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-slate-400">{label}</p>
        {delta !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold ${
              isGood ? "text-severity-low" : "text-severity-critical"
            }`}
          >
            {isUp ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-2xl font-bold text-white">
        {numeric ? animatedValue : value}
      </p>
      {children && <div className="mt-2">{children}</div>}
      {delta !== undefined && <p className="mt-1 text-[10px] text-slate-500">{resolvedBaseline}</p>}
    </div>
  );
}
