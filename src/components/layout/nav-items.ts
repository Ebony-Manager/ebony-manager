import { FileText, Folder, Calendar, DollarSign, BarChart2, Users, Hammer, Layers, UserCog, type LucideIcon } from "lucide-react";
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
 * Compartido entre `sidebar.tsx` (los renderiza) y `navbar.tsx` (los lee
 * para armar el breadcrumb "Administración / Planilla") — una sola lista,
 * así nunca quedan desincronizados.
 */

// Módulos de trabajo del día a día — links directos del rail, sin panel.
export const RAIL_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion, modules: ["cotizacion"] },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

// El panel de "Administración" tiene, en este orden: Dashboard (global:
// Planilla + Contratistas juntos), Planilla, Contratistas y Usuarios. Cada
// usuario ve solo los que le tocan; el ícono del rail aparece si ve al menos
// uno y lleva al primero que vea. El gate de verdad sigue siendo
// requireModule()/requireAdmin() en cada página + RLS.
export const ADMIN_PANEL_ITEMS: NavItem[] = [
  { href: "/administracion", icon: Layers, label: strings.nav.resumenPlanillas, modules: ["planilla", "contratistas"] },
  { href: "/planilla", icon: Users, label: strings.nav.taller, modules: ["planilla"] },
  { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas, modules: ["contratistas"] },
  { href: "/usuarios", icon: UserCog, label: strings.nav.usuarios, adminOnly: true },
];

/**
 * "Administración / Planilla" — un módulo del panel de Administración da
 * dos crumbs; uno del rail (sin panel) da uno solo ("Cronograma"). Sin
 * match (ej. `/`, fuera de (app)) no rinde nada. Vive acá (no en
 * navbar.tsx) porque el breadcrumb ahora lo pinta cada pantalla dentro de
 * su propio contenido (ver planilla-client.tsx), no el navbar global.
 */
export function breadcrumbFor(pathname: string, lang: "es" | "en"): string[] {
  const adminItem = ADMIN_PANEL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (adminItem) return [t(lang, strings.nav.administracion), t(lang, adminItem.label)];
  const railItem = RAIL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (railItem) return [t(lang, railItem.label)];
  return [];
}
