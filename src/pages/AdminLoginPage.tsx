import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signInAdmin } from "../lib/adminAuth";

/**
 * The only screen in the app that requires a login. Citizens never see
 * this — it's reached solely via /admin/login, linked from the admin
 * dashboard/findings pages when no admin session is present.
 */
export function AdminLoginPage() {
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
      setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-100">دخول الإدارة</h1>
          <p className="mt-1 text-sm text-slate-400">
            الصفحة دي للإدارة بس — المواطنين مش محتاجين تسجيل دخول عشان يبلّغوا.
          </p>
        </div>

        <label className="block text-sm text-slate-300">
          الإيميل
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
          />
        </label>

        <label className="block text-sm text-slate-300">
          كلمة المرور
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-500 px-3 py-2 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
