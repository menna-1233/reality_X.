import { motion } from "motion/react";

export function Sparkline({
  values,
  color,
  variant = "line",
}: {
  values: number[];
  color: string;
  variant?: "line" | "bar";
}) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = variant === "bar" ? 0 : Math.min(...values, 0);
  const range = max - min || 1;

  if (variant === "bar") {
    const gap = 1.5;
    const barW = w / values.length - gap;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full overflow-visible" preserveAspectRatio="none">
        {values.map((v, i) => {
          const barH = Math.max(((v - min) / range) * h, 1.5);
          return (
            <motion.rect
              key={i}
              x={i * (barW + gap)}
              width={barW}
              rx={1}
              fill={color}
              opacity={i === values.length - 1 ? 1 : 0.45}
              initial={{ height: 0, y: h }}
              animate={{ height: barH, y: h - barH }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: "easeOut" }}
            />
          );
        })}
      </svg>
    );
  }

  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  const last = values[values.length - 1];
  const lastX = (values.length - 1) * step;
  const lastY = h - ((last - min) / range) * h;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full overflow-visible" preserveAspectRatio="none">
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r="2.5"
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, duration: 0.25 }}
      />
    </svg>
  );
}
