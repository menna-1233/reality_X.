import {
  ClipboardList,
  Eye,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Send,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useGlassPointer } from "../hooks/useGlassPointer";
import { signOutAdmin } from "../lib/adminAuth";
import { useAdminSession } from "../lib/useAdminSession";

// Public — every visitor (citizen or admin) sees these, no login needed.
const PUBLIC_NAV = [
  { to: "/", end: true, icon: Send, label: "بلّغ" },
  { to: "/feed", end: false, icon: Inbox, label: "البلاغات" },
];

// Admin-only — shown in the nav only once an admin session is confirmed.
// The routes themselves are still gated by RequireAdmin regardless.
const ADMIN_NAV = [
  { to: "/dashboard", end: false, icon: LayoutDashboard, label: "نظرة عامة" },
  { to: "/findings", end: false, icon: ClipboardList, label: "إدارة البلاغات" },
];

// capsule, not rounded-lg: Apple's Liquid Glass controls default to a
// capsule shape ("`.glassEffect()` applies the `.regular` variant in a
// `.capsule` shape") — this pill is the nav's glass-layer active highlight,
// the same role as a tab bar's sliding capsule indicator.
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-accent-500/12 text-accent-400"
      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
  }`;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const adminStatus = useAdminSession();
  const isAdmin = adminStatus === "in";

  async function handleSignOut() {
    await signOutAdmin();
    onNavigate?.();
    navigate("/");
  }

  return (
    <>
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-ink-950">
          <Eye size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">UrbanEye AI</p>
          <p className="truncate text-[11px] text-slate-500">عين ذكية على مجتمعك</p>
        </div>
      </div>

      <NavLink
        to="/"
        end
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(240,85,42,0.6)] transition hover:bg-accent-600"
      >
        <Send size={15} /> بلاغ جديد
      </NavLink>

      <nav className="flex flex-1 flex-col gap-0.5">
        {PUBLIC_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={navLinkClass}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              الإدارة
            </p>
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={navLinkClass}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="space-y-2 border-t border-white/8 pt-3">
        <a
          href="#"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <HelpCircle size={16} />
          المساعدة والتوثيق
        </a>
        {isAdmin ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
          >
            <LogOut size={16} />
            تسجيل خروج (الإدارة)
          </button>
        ) : (
          <NavLink
            to="/admin/login"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
          >
            <LogIn size={16} />
            دخول الإدارة
          </NavLink>
        )}
      </div>
    </>
  );
}

export function AppShell({
  title,
  breadcrumbs,
  actions,
  children,
}: {
  title: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useGlassPointer<HTMLElement>();
  const headerRef = useGlassPointer<HTMLElement>();

  return (
    <div className="flex min-h-screen">
      <aside
        ref={sidebarRef}
        className="glass-surface sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-e border-white/8 p-4 md:flex"
      >
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="glass-overlay absolute inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="glass-surface absolute inset-y-0 start-0 flex w-72 flex-col gap-4 rounded-e-2xl p-4">
            <button
              onClick={() => setDrawerOpen(false)}
              className="self-end rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
              aria-label="إغلاق القائمة"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          ref={headerRef}
          className="glass-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-6"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 md:hidden"
              aria-label="فتح القائمة"
            >
              <Menu size={20} />
            </button>
            <div>
              {breadcrumbs && breadcrumbs.length > 0 && (
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {breadcrumbs.join(" / ")}
                </p>
              )}
              <h1 className="text-lg font-bold text-white md:text-xl">{title}</h1>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          <div className="scroll-edge-fade" aria-hidden="true" />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
