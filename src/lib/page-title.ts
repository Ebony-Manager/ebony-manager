import { breadcrumbFor } from "@/components/layout/nav-items";
import { strings, t } from "@/lib/i18n";

/**
 * El nombre de la pestaña del navegador: lo específico primero (la pestaña
 * se corta por la derecha) y luego la sección — "COT-2640 Teo Zebede ·
 * Cotización", "Stock · Almacén". Sin "Ebony": ya lo dice el ícono.
 */

type Lang = "es" | "en";
const T = (lang: Lang, k: keyof typeof strings.titles) => t(lang, strings.titles[k]);

/** Une las partes que tengan texto (y ● delante si hay cambios sin guardar). */
export function joinTitle(parts: readonly (string | null | undefined | false)[], dirty = false): string {
  const text = parts
    .map((p) => (p ? p.trim() : ""))
    .filter(Boolean)
    .join(" · ");
  return `${dirty ? "● " : ""}${text || "Ebony"}`;
}

/** El nombre genérico de cada pantalla (cuando la pantalla no pone uno propio). */
export function routeTitleParts(pathname: string, lang: Lang): string[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  const sales = t(lang, strings.nav.cotizacion);
  const fixed: Record<string, string[]> = {
    "/cotizacion": [T(lang, "quotes"), sales],
    "/cotizacion/seguimiento": [T(lang, "follow_up"), sales],
    "/cotizacion/clientes": [T(lang, "clients"), sales],
    "/cotizacion/costos": [T(lang, "costs"), T(lang, "quotes")],
    "/cotizacion/nueva": [T(lang, "new_quote")],
    "/inspecciones/programacion": [T(lang, "schedule"), t(lang, strings.nav.inspecciones)],
    "/almacen/ajustes": [T(lang, "adjustments"), t(lang, strings.nav.almacen)],
    "/almacen/conteo": [T(lang, "count"), t(lang, strings.nav.almacen)],
    "/almacen/movimientos": [T(lang, "movements"), t(lang, strings.nav.almacen)],
    "/almacen/revision": [T(lang, "review"), t(lang, strings.nav.almacen)],
    "/almacen/proveedores": [T(lang, "suppliers"), t(lang, strings.nav.almacen)],
  };
  if (fixed[p]) return fixed[p];
  if (p.startsWith("/cotizacion/")) return [T(lang, "quote")];
  if (p.startsWith("/proyectos/")) return [T(lang, "project")];
  if (p.startsWith("/personal/staff/empleados/")) return [T(lang, "employee")];
  if (p.startsWith("/personal/staff/contratistas/")) return [T(lang, "contractor")];
  // El resto, como el menú ("Personal / Pagos" → "Pagos · Personal").
  return breadcrumbFor(p, lang).reverse();
}
