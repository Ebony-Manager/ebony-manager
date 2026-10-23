"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemePref } from "@/lib/theme";

export type { ThemePref };

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function readStoredPref(): ThemePref {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

const ThemeContext = createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void }>({
  theme: "system",
  setTheme: () => {},
});

/** Claro / Oscuro / Automático (sigue al sistema). Cada navegador guarda el suyo. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Arranca en "system" en servidor y primer render; la preferencia guardada
  // se lee después de hidratar (localStorage no existe en el servidor). La
  // clase `.dark` ya la puso THEME_INIT_SCRIPT, así que no hay parpadeo.
  const [theme, setThemeState] = useState<ThemePref>("system");

  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage, solo existe en el navegador (mismo patrón que language-context). */
  useEffect(() => {
    setThemeState(readStoredPref());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // En "Automático", seguir los cambios del sistema mientras la app está abierta.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePref) => {
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento (ventana privada estricta): igual se aplica en esta pestaña.
    }
    applyTheme(next);
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
