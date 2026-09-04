"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

const LanguageContext = createContext<{ lang: Lang; toggle: () => void }>({
  lang: "es",
  toggle: () => {},
});

const STORAGE_KEY = "ebony_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Starts at the default 'es' on both server and first client render, then
  // restores the saved language in an effect — reading localStorage during
  // render (like the old Vite useState(() => localStorage.getItem(...)))
  // doesn't exist on the server and would desync from the SSR'd markup.
  const [lang, setLang] = useState<Lang>("es");

  /* eslint-disable react-hooks/set-state-in-effect -- must run post-hydration, not during render, because it reads browser-only localStorage (same pattern as Atlas's readStoredColumns). */
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "es" || saved === "en") setLang(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle() {
    setLang((current) => {
      const next: Lang = current === "es" ? "en" : "es";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return <LanguageContext.Provider value={{ lang, toggle }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}
