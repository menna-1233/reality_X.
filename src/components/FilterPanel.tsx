import { Filter } from "lucide-react";
import { useState } from "react";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string; dot?: string }[];
}

export function FilterPanel({
  groups,
  active,
  onChange,
}: {
  groups: FilterGroup[];
  active: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(active).filter((v) => v !== "all").length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="surface-panel flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
      >
        <Filter size={14} />
        فلترة
        {activeCount > 0 && (
          <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="glass-overlay absolute end-0 top-full z-20 mt-2 w-64 space-y-3 rounded-xl border border-white/10 p-3">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {g.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange(g.key, opt.value)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                        active[g.key] === opt.value
                          ? "bg-accent-500 text-white"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {opt.dot && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: opt.dot }}
                        />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
