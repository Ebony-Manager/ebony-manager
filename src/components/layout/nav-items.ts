import { FileText, Folder, Calendar, DollarSign, BarChart2, Users, Hammer, Layers, type LucideIcon } from "lucide-react";
import { t, strings } from "@/lib/i18n";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
}

/**
 * Compartido entre `sidebar.tsx` (los renderiza) y `navbar.tsx` (los lee
 * para armar el breadcrumb "Administración / Planilla") — una sola lista,
 * así nunca quedan desincronizados.
 */

// Módulos de trabajo del día a día — links directos del rail, sin panel.
export const RAIL_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

// El panel de "Administración" (siempre visible para un admin) tiene, en este
// orden: Dashboard (global: Planilla + Contratistas juntos), Planilla y
// Contratistas. El gate de verdad sigue siendo requireAdmin() en cada página +
// RLS. El primero es también a donde lleva el ícono del rail.
export const ADMIN_PANEL_ITEMS: NavItem[] = [
  { href: "/administracion", icon: Layers, label: strings.nav.resumenPlanillas },
  { href: "/planilla", icon: Users, label: strings.nav.taller },
  { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas },
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
