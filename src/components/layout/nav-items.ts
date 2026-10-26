import {
  FileText,
  Folder,
  BarChart2,
  CalendarCheck,
  Wallet,
  Layers,
  UserCog,
  Users,
  Settings,
  Contact,
  Warehouse,
  Boxes,
  PackageMinus,
  ShoppingCart,
  BookUser,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { t, strings } from "@/lib/i18n";
import { hasAnyModule, hasModule, hasModules, type AccessSubject, type AppModule } from "@/lib/auth/modules";

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
  /** Se esconde si el usuario tiene alguno de estos (ej. "Asistencia" suelta solo para quien no ve Pagos). */
  notModules?: AppModule[];
  /** Activo solo en su ruta exacta, no en sus sub-rutas (el Resumen en /personal, que no debe marcarse en /personal/staff). */
  exact?: boolean;
  /** Otras rutas que cuentan como esta (ej. Movimientos es parte de Inventario). */
  alsoActive?: string[];
}

/** El menú solo muestra lo que el usuario puede abrir; el gate real es requireModule() + RLS. */
export function canSeeNavItem(item: NavItem, subject: AccessSubject | null | undefined): boolean {
  if (item.adminOnly) return subject?.role === "admin";
  if (item.notModules && hasAnyModule(subject, item.notModules)) return false;
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
  // Directorio de proveedores (materiales y servicios): de la empresa, no solo del Almacén.
  { href: "/directorio", icon: BookUser, label: strings.nav.directorio, anyModules: ["almacen", "directorio"] },
  // Cronograma y Gastos salen del menú hasta que se construyan (sus rutas siguen, en "Próximamente").
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

/**
 * Un ícono del rail que, al entrar a cualquiera de sus rutas, abre al lado un
 * panel crema con sus ítems. Cada usuario ve solo los ítems que le tocan; el
 * ícono aparece si ve al menos uno y lleva al primero que vea. El gate de
 * verdad sigue siendo requireModule()/requireAdmin() en cada página + RLS.
 */
export interface NavPanel {
  key: "personal" | "almacen" | "settings";
  icon: LucideIcon;
  title: (typeof strings.nav)[keyof typeof strings.nav];
  items: NavItem[];
  /** A dónde lleva el ícono si el usuario lo ve (si no, al primer ítem): el trabajo del día, no el resumen. */
  home?: (subject: AccessSubject | null | undefined) => string;
}

/** A dónde lleva el ícono de un panel (con sus ítems ya filtrados por permiso). */
export function panelHome(panel: NavPanel, subject: AccessSubject | null | undefined): NavItem | undefined {
  const home = panel.home?.(subject);
  return panel.items.find((i) => i.href === home) ?? panel.items[0];
}

// Personal — en el rail, debajo de los módulos de trabajo: Resumen (uno
// solo, con filtro Todos / Empleados / Contratistas), Personal (todos
// juntos) y Pagos (asistencia, quincena, contratistas, préstamos…). Cada
// pestaña de adentro pide su propio módulo.
export const PERSONAL_PANEL: NavPanel = {
  key: "personal",
  icon: Users,
  title: strings.nav.personal,
  items: [
    { href: "/personal", icon: Layers, label: strings.nav.resumenPersonal, anyModules: ["planilla", "contratistas"], exact: true },
    // Quien tiene Asistencia sin Planilla ni Contratistas (ej. jefa de taller): "Asistencia" con su
    // pantalla, primera (el ícono de Personal abre aquí) y sin la palabra "Pagos".
    { href: "/personal/asistencia", icon: CalendarCheck, label: strings.nav.asistencia, modules: ["asistencia"], notModules: ["planilla", "contratistas"] },
    { href: "/personal/staff", icon: Contact, label: strings.nav.staff, modules: ["documentos"] },
    { href: "/personal/pagos", icon: Wallet, label: strings.nav.pagos, anyModules: ["planilla", "contratistas"] },
  ],
};

// Almacén — inventario (con sus movimientos y ajustes), salidas y compras (los proveedores viven en el Directorio). Compras
// lo ve cualquiera (para pedir lo que haga falta; quien no tiene Compras ve
// solo sus solicitudes), así que todos ven el ícono.
export const ALMACEN_PANEL: NavPanel = {
  key: "almacen",
  icon: Warehouse,
  title: strings.nav.almacen,
  // Sin Compras (almacenista, jefa de taller) el ícono abre Nueva salida; con Compras, Inventario.
  home: (subject) => (hasModule(subject, "almacen_compras") ? "/almacen" : "/almacen/salidas"),
  items: [
    { href: "/almacen/resumen", icon: Layers, label: strings.nav.resumenPersonal, modules: ["almacen"] },
    { href: "/almacen", icon: Boxes, label: strings.nav.existencias, modules: ["almacen"], exact: true, alsoActive: ["/almacen/movimientos", "/almacen/conteo", "/almacen/revision"] },
    { href: "/almacen/salidas", icon: PackageMinus, label: strings.nav.salidas, modules: ["almacen"] },
    { href: "/almacen/compras", icon: ShoppingCart, label: strings.nav.compras },
  ],
};

// Settings — el engranaje al pie del rail: configuración de la app.
export const SETTINGS_PANEL: NavPanel = {
  key: "settings",
  icon: Settings,
  title: strings.nav.settings,
  items: [
    { href: "/settings/usuarios", icon: UserCog, label: strings.nav.usuarios, adminOnly: true },
    { href: "/settings/notificaciones", icon: Bell, label: strings.nav.notificaciones, adminOnly: true },
  ],
};

export const NAV_PANELS: NavPanel[] = [ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return (
    pathname === item.href ||
    (!item.exact && pathname.startsWith(`${item.href}/`)) ||
    (item.alsoActive ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
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
