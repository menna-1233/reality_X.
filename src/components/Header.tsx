import { Eye } from "lucide-react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand-600 text-white"
      : "text-brand-900 hover:bg-brand-100"
  }`;

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Eye size={20} />
          </span>
          <div>
            <p className="text-base font-bold text-brand-900">UrbanEye AI</p>
            <p className="text-xs text-slate-500">عين ذكية على مجتمعك</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            بلّغ
          </NavLink>
          <NavLink to="/feed" className={linkClass}>
            البلاغات
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
