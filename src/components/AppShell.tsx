import {
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useGlassPointer } from "../hooks/useGlassPointer";
import { signOutAdmin } from "../lib/adminAuth";
import { useAdminSession } from "../lib/useAdminSession";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Public — every visitor (citizen or admin) sees these, no login needed.
const PUBLIC_NAV = [
  { to: "/", end: true, icon: Send, labelKey: "nav.report" },
  { to: "/feed", end: false, icon: Inbox, labelKey: "nav.reports" },
] as const;

// Admin-only — shown in the nav only once an admin session is confirmed.
// The routes themselves are still gated by RequireAdmin regardless.
const ADMIN_NAV = [
  { to: "/dashboard", end: false, icon: LayoutDashboard, labelKey: "nav.overview" },
  { to: "/findings", end: false, icon: ClipboardList, labelKey: "nav.manageReports" },
] as const;

const SIDEBAR_COLLAPSED_KEY = "urbaneye.sidebarCollapsed";

function readStoredSidebarCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // localStorage unavailable — fall through to the default
  }
  // Collapsed by default for anyone who hasn't explicitly toggled it.
  return true;
}

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status: adminStatus, email: adminEmail } = useAdminSession();
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
          <X size={20} strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{t("common.appName")}</p>
          <p className="truncate text-[11px] text-slate-500">{t("common.tagline")}</p>
        </div>
      </div>

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
            {t(item.labelKey)}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {t("nav.adminSection")}
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
                {t(item.labelKey)}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="space-y-2 border-t border-white/8 pt-3">
        {isAdmin ? (
          <>
            {adminEmail && (
              <p className="truncate px-3 text-[11px] text-slate-500" title={adminEmail}>
                {adminEmail}
              </p>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
            >
              <LogOut size={16} />
              {t("nav.adminSignOut")}
            </button>
          </>
        ) : (
          <NavLink
            to="/admin/login"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
          >
            <LogIn size={16} />
            {t("nav.adminLogin")}
          </NavLink>
        )}
      </div>

      <div className="border-t border-white/8 pt-3">
        <LanguageSwitcher />
      </div>
    </>
  );
}

// Routes that need all the horizontal room they can get — the report form
// (image + fields) and the map/list-heavy admin screens (dashboard,
// findings) — force-collapse the sidebar the moment the user navigates to
// one of them. They can still reopen it with the toggle below if they need
// the nav.
const AUTO_COLLAPSE_ROUTES = ["/", "/dashboard", "/findings"];

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
  const { t } = useTranslation();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed);
  const [lastRoute, setLastRoute] = useState(location.pathname);
  const sidebarRef = useGlassPointer<HTMLElement>();
  const headerRef = useGlassPointer<HTMLElement>();

  // Force-collapse on entry to any AUTO_COLLAPSE_ROUTES route. Adjusted
  // during render (not an effect) so it lands in the same commit as the
  // navigation instead of causing an extra render pass.
  if (location.pathname !== lastRoute) {
    setLastRoute(location.pathname);
    if (AUTO_COLLAPSE_ROUTES.includes(location.pathname)) {
      setSidebarCollapsed(true);
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore write failures — the toggle still works for this session
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      {!sidebarCollapsed && (
        <aside
          ref={sidebarRef}
          className="glass-surface sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-e border-white/8 p-4 md:flex"
        >
          <SidebarContent />
        </aside>
      )}

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
              aria-label={t("nav.closeMenu")}
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
          className="glass-surface sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-6"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 md:hidden"
              aria-label={t("nav.openMenu")}
            >
              <Menu size={20} />
            </button>
            <button
              onClick={toggleSidebar}
              className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/5 md:flex"
              aria-label={sidebarCollapsed ? t("nav.openMenu") : t("nav.closeMenu")}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
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
          <div className="ms-auto flex items-center gap-2">{actions}</div>
          <div className="scroll-edge-fade" aria-hidden="true" />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
