import { FileText, Folder, Calendar, DollarSign, BarChart2, Users, Hammer, Layers, UserCog, Briefcase, Settings, type LucideIcon } from "lucide-react";
import { t, strings } from "@/lib/i18n";
import { hasModules, type AccessSubject, type AppModule } from "@/lib/auth/modules";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
  /** Módulos que hacen falta (todos) para ver el ítem. Sin esto lo ve cualquiera. */
  modules?: AppModule[];
  /** Solo para el rol admin (ej. Usuarios). */
  adminOnly?: boolean;
}

/** El menú solo muestra lo que el usuario puede abrir; el gate real es requireModule() + RLS. */
export function canSeeNavItem(item: NavItem, subject: AccessSubject | null | undefined): boolean {
  if (item.adminOnly) return subject?.role === "admin";
  return !item.modules || hasModules(subject, item.modules);
}

/**
 * Compartido entre `sidebar.tsx` (los renderiza) y `breadcrumbFor` (lo
 * pinta cada pantalla: "Administración / Planilla") — una sola lista, así
 * nunca quedan desincronizados.
 */

// Módulos de trabajo del día a día — links directos del rail, sin panel.
export const RAIL_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion, modules: ["cotizacion"] },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
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
  key: "administracion" | "settings";
  icon: LucideIcon;
  title: (typeof strings.nav)[keyof typeof strings.nav];
  items: NavItem[];
}

// Administración — en el rail, debajo de los módulos de trabajo: Dashboard
// (global: Planilla + Contratistas juntos), Planilla y Contratistas.
export const ADMIN_PANEL: NavPanel = {
  key: "administracion",
  icon: Briefcase,
  title: strings.nav.administracion,
  items: [
    { href: "/administracion", icon: Layers, label: strings.nav.resumenPlanillas, modules: ["planilla", "contratistas"] },
    { href: "/planilla", icon: Users, label: strings.nav.taller, modules: ["planilla"] },
    { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas, modules: ["contratistas"] },
  ],
};

// Settings — el engranaje al pie del rail: configuración de la app.
export const SETTINGS_PANEL: NavPanel = {
  key: "settings",
  icon: Settings,
  title: strings.nav.settings,
  items: [{ href: "/settings/usuarios", icon: UserCog, label: strings.nav.usuarios, adminOnly: true }],
};

export const NAV_PANELS: NavPanel[] = [ADMIN_PANEL, SETTINGS_PANEL];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * "Administración / Planilla" o "Settings / Usuarios" — un ítem de panel da
 * dos crumbs; uno del rail (sin panel) da uno solo ("Cronograma"). Sin match
 * (ej. `/`, fuera de (app)) no rinde nada. Lo pinta cada pantalla dentro de
 * su propio contenido (ver planilla-client.tsx).
 */
export function breadcrumbFor(pathname: string, lang: "es" | "en"): string[] {
  for (const panel of NAV_PANELS) {
    const item = panel.items.find((i) => isNavItemActive(i, pathname));
    if (item) return [t(lang, panel.title), t(lang, item.label)];
  }
  const railItem = RAIL_ITEMS.find((i) => isNavItemActive(i, pathname));
  if (railItem) return [t(lang, railItem.label)];
  return [];
}
