import type { ReactNode } from "react";

export function Chip({
  active,
  onClick,
  children,
  count,
  dot,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  count?: number;
  dot?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-accent-500 text-white"
          : "surface-panel border border-white/8 text-slate-300 hover:text-white"
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
      {count !== undefined && <span className="opacity-60">· {count}</span>}
    </button>
  );
}
