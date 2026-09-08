import { useTranslation } from "react-i18next";
import type { AppLanguage } from "../i18n/config";

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current: AppLanguage = i18n.language === "en" ? "en" : "ar";

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className="surface-panel grid grid-cols-2 gap-0.5 rounded-full border border-white/8 p-0.5"
    >
      {LANGUAGES.map((lng) => (
        <button
          key={lng.code}
          type="button"
          onClick={() => i18n.changeLanguage(lng.code)}
          aria-pressed={current === lng.code}
          className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
            current === lng.code
              ? "bg-accent-500 text-white"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {lng.label}
        </button>
      ))}
    </div>
  );
}
