import { motion } from "motion/react";
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="surface-panel overflow-hidden rounded-xl border border-white/8">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                className={`border-b border-white/5 last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-white/[0.04]" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-slate-200">
                    {col.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
