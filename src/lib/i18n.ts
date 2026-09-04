// Bilingual strings — ES (primary) / EN (secondary).
//
// Trimmed to what the foundation shell (Sidebar/Navbar/Login) needs. The
// old quote.*/plan.* dictionaries lived here too, but those belong to
// Cotización, which is archived in _legacy/ and not wired into the new
// app — porting its strings here would just be dead weight. They're still
// in _legacy/src/lib/i18n.js when Cotización gets rebuilt.

export type Lang = "es" | "en";

interface Entry {
  es: string;
  en: string;
}

export const strings = {
  nav: {
    cotizacion: { es: "Cotización", en: "Quote" },
    proyectos: { es: "Proyectos", en: "Projects" },
    cronograma: { es: "Cronograma", en: "Schedule" },
    gastos: { es: "Gastos", en: "Expenses" },
    dashboard: { es: "Dashboard", en: "Dashboard" },
  },

  common: {
    loading: { es: "Cargando…", en: "Loading…" },
    comingSoon: { es: "Este módulo estará disponible próximamente.", en: "This module will be available soon." },
  },

  auth: {
    signIn: { es: "Iniciar sesión con Google", en: "Sign in with Google" },
    signOut: { es: "Cerrar sesión", en: "Sign out" },
    welcome: { es: "Bienvenido a Ebony Manager", en: "Welcome to Ebony Manager" },
    subtitle: {
      es: "Sistema de gestión para Ebony Custom Woodwork",
      en: "Management system for Ebony Custom Woodwork",
    },
  },
} as const satisfies Record<string, Record<string, Entry>>;

/** Get a string in the current language. Usage: t(lang, strings.nav.cotizacion) */
export function t(lang: Lang, entry: Entry): string {
  if (!entry) return "";
  return entry[lang] ?? entry.es ?? "";
}
