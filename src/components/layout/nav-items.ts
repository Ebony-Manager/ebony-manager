import { FileText, Folder, Calendar, DollarSign, BarChart2, Users, Hammer, type LucideIcon } from "lucide-react";
import { strings } from "@/lib/i18n";

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

// Planilla y Contratistas viven en el panel de "Administración", siempre
// visible para un admin. El gate de verdad sigue siendo requireAdmin() en
// cada página + RLS.
export const ADMIN_PANEL_ITEMS: NavItem[] = [
  { href: "/planilla", icon: Users, label: strings.nav.taller },
  { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas },
];
