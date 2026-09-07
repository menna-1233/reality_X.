import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export function SlideOver({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            className="glass-overlay absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="glass-panel relative flex h-full w-full max-w-lg flex-col rounded-none border-y-0 border-e-0 p-5"
            initial={{ opacity: 0, scale: 0.97, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97, x: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
