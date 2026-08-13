import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Locale, Localized } from "./types";

const KEY = "lednique-locale";

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    /* ignore */
  }
  const lang = typeof navigator !== "undefined" ? navigator.language : "en";
  return lang.toLowerCase().startsWith("ru") ? "ru" : "en";
}

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (en: string, ru: string) => string;
  loc: (value: Localized | string | undefined) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const value = useMemo<Ctx>(() => {
    function setLocale(next: Locale) {
      setLocaleState(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
    }
    return {
      locale,
      setLocale,
      t: (en, ru) => (locale === "ru" ? ru : en),
      loc: (value) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return locale === "ru" ? value.ru || value.en : value.en || value.ru;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}

export function pickLocale<T>(locale: Locale, pair: { en: T; ru: T }, enEnabled: boolean): T {
  if (locale === "en" && !enEnabled) return pair.ru;
  return locale === "ru" ? pair.ru : pair.en;
}
