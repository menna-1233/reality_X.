import { Eye, LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand-500 text-ink-950"
      : "text-slate-300 hover:bg-white/10"
  }`;

export function Header() {
  return (
    <header className="glass-panel sticky top-0 z-10 border-b border-white/10">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-ink-950">
            <Eye size={20} />
          </span>
          <div>
            <p className="text-base font-bold text-white">UrbanEye AI</p>
            <p className="text-xs text-slate-400">عين ذكية على مجتمعك</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            بلّغ
          </NavLink>
          <NavLink to="/feed" className={linkClass}>
            البلاغات
          </NavLink>
          <NavLink
            to="/dashboard"
            className="ms-1 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-slate-200 md:inline-flex"
          >
            <LayoutDashboard size={14} />
            لوحة الإدارة
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
