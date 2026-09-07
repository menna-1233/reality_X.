import { ArrowDown, ArrowUp } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

function useCountUp(target: number) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }
    const from = prevRef.current;
    const controls = animate(from, target, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevRef.current = target;
    return () => controls.stop();
  }, [target, prefersReduced]);

  return display;
}

export function StatTile({
  label,
  value,
  delta,
  deltaGoodDirection = "down",
  baseline = "من الأسبوع الماضي",
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
  const isUp = (delta ?? 0) > 0;
  const isGood = delta === undefined ? null : (isUp ? "up" : "down") === deltaGoodDirection;
  const numeric = typeof value === "number";
  const animatedValue = useCountUp(numeric ? value : 0);

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
      {delta !== undefined && <p className="mt-1 text-[10px] text-slate-500">{baseline}</p>}
    </div>
  );
}
