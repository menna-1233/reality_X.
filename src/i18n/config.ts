import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export type AppLanguage = "ar" | "en";

/** Same key the inline bootstrap script in index.html reads before React mounts. */
export const LANGUAGE_STORAGE_KEY = "urbaneye.lang";

function detectInitialLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // localStorage unavailable (private mode, disabled storage, etc.) — fall through
  }
  // The app has always been Arabic-first; keep that as the default for anyone
  // who hasn't explicitly switched.
  return "ar";
}

export function applyDocumentDirection(lang: AppLanguage) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

const initialLanguage = detectInitialLanguage();

void i18next.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

applyDocumentDirection(initialLanguage);

i18next.on("languageChanged", (lng) => {
  const lang: AppLanguage = lng === "en" ? "en" : "ar";
  applyDocumentDirection(lang);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // ignore write failures — direction/lang still applied for this session
  }
});

export default i18next;
