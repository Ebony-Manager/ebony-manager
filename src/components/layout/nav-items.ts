import { FileText, Folder, Calendar, DollarSign, BarChart2, Wallet, Layers, UserCog, Briefcase, Settings, Contact, type LucideIcon } from "lucide-react";
import { t, strings } from "@/lib/i18n";
import { hasAnyModule, hasModules, type AccessSubject, type AppModule } from "@/lib/auth/modules";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
  /** Módulos que hacen falta (todos) para ver el ítem. Sin esto lo ve cualquiera. */
  modules?: AppModule[];
  /** Alternativa a `modules`: alcanza con uno de estos. */
  anyModules?: AppModule[];
  /** Solo para el rol admin (ej. Usuarios). */
  adminOnly?: boolean;
  /** Activo solo en su ruta exacta, no en sus sub-rutas (el Resumen en /personal, que no debe marcarse en /personal/staff). */
  exact?: boolean;
}

/** El menú solo muestra lo que el usuario puede abrir; el gate real es requireModule() + RLS. */
export function canSeeNavItem(item: NavItem, subject: AccessSubject | null | undefined): boolean {
  if (item.adminOnly) return subject?.role === "admin";
  if (item.anyModules) return hasAnyModule(subject, item.anyModules);
  return !item.modules || hasModules(subject, item.modules);
}

/**
 * Compartido entre `sidebar.tsx` (los renderiza) y `breadcrumbFor` (lo
 * pinta cada pantalla: "Personal / Pagos") — una sola lista, así
 * nunca quedan desincronizados.
 */

// Módulos de trabajo del día a día — links directos del rail, sin panel.
export const RAIL_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion, modules: ["cotizacion"] },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos, anyModules: ["proyectos", "contratistas"] },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

/**
 * Un ícono del rail que, al entrar a cualquiera de sus rutas, abre al lado un
 * panel crema con sus ítems. Cada usuario ve solo los ítems que le tocan; el
 * ícono aparece si ve al menos uno y lleva al primero que vea. El gate de
 * verdad sigue siendo requireModule()/requireAdmin() en cada página + RLS.
 */
export interface NavPanel {
  key: "personal" | "settings";
  icon: LucideIcon;
  title: (typeof strings.nav)[keyof typeof strings.nav];
  items: NavItem[];
}

// Personal — en el rail, debajo de los módulos de trabajo: Resumen (uno
// solo, con filtro Todos / Empleados / Contratistas), Personal (todos
// juntos) y Pagos (asistencia, quincena, contratistas, préstamos…). Cada
// pestaña de adentro pide su propio módulo.
export const PERSONAL_PANEL: NavPanel = {
  key: "personal",
  icon: Briefcase,
  title: strings.nav.personal,
  items: [
    { href: "/personal", icon: Layers, label: strings.nav.resumenPersonal, anyModules: ["planilla", "contratistas"], exact: true },
    { href: "/personal/staff", icon: Contact, label: strings.nav.staff, anyModules: ["planilla", "contratistas"] },
    { href: "/personal/pagos", icon: Wallet, label: strings.nav.pagos, anyModules: ["planilla", "contratistas"] },
  ],
};

// Settings — el engranaje al pie del rail: configuración de la app.
export const SETTINGS_PANEL: NavPanel = {
  key: "settings",
  icon: Settings,
  title: strings.nav.settings,
  items: [{ href: "/settings/usuarios", icon: UserCog, label: strings.nav.usuarios, adminOnly: true }],
};

export const NAV_PANELS: NavPanel[] = [PERSONAL_PANEL, SETTINGS_PANEL];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

/**
 * "Personal / Pagos" o "Settings / Usuarios" — un ítem de panel da
 * dos crumbs; uno del rail (sin panel) da uno solo ("Cronograma"). Sin match
 * (ej. `/`, fuera de (app)) no rinde nada. Lo pinta cada pantalla dentro de
 * su propio contenido (ver pagos-client.tsx).
 */
export function breadcrumbFor(pathname: string, lang: "es" | "en"): string[] {
  for (const panel of NAV_PANELS) {
    const item = panel.items.find((i) => isNavItemActive(i, pathname));
    // "Personal / Personal" (el panel y su lista se llaman igual en español) → un solo crumb.
    if (item) return t(lang, panel.title) === t(lang, item.label) ? [t(lang, item.label)] : [t(lang, panel.title), t(lang, item.label)];
  }
  const railItem = RAIL_ITEMS.find((i) => isNavItemActive(i, pathname));
  if (railItem) return [t(lang, railItem.label)];
  return [];
}
