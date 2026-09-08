import { Eye } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { signInAdmin } from "../lib/adminAuth";

/**
 * The only screen in the app that requires a login. Citizens never see
 * this — it's reached solely via /admin/login, linked from the admin
 * dashboard/findings pages when no admin session is present.
 */
export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInAdmin(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminLoginPage.signInError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <form
        onSubmit={handleSubmit}
        className="surface-panel w-full max-w-sm space-y-4 rounded-xl border border-white/8 p-6"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-ink-950">
            <Eye size={18} />
          </span>
          <h1 className="text-lg font-bold text-white">{t("nav.adminLogin")}</h1>
        </div>

        <label className="block text-sm text-slate-300">
          {t("adminLoginPage.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="surface-panel mt-1 w-full rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </label>

        <label className="block text-sm text-slate-300">
          {t("adminLoginPage.password")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="surface-panel mt-1 w-full rounded-lg border border-white/8 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-accent-400/20 bg-accent-500/10 p-3">
            <p className="text-sm text-accent-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 py-3 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-70"
        >
          {loading ? t("adminLoginPage.signingIn") : t("adminLoginPage.signIn")}
        </button>
      </form>
    </div>
  );
}
