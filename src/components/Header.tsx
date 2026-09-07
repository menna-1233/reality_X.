import { Eye } from "lucide-react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-ember-500 text-ink-950"
      : "text-mist-300 hover:bg-white/5 hover:text-mist-100"
  }`;

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-500 text-ink-950 shadow-[0_0_18px_rgba(255,106,43,0.45)]">
            <Eye size={20} />
          </span>
          <div>
            <p className="text-base font-bold text-mist-100">UrbanEye AI</p>
            <p className="text-xs text-mist-500">عين ذكية على مجتمعك</p>
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
