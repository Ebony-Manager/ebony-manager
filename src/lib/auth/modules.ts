// Permisos por módulo — la lista única de qué módulos se pueden dar a un
// usuario y las reglas puras para decidir a qué entra. Sin Supabase ni
// React: lo usan el servidor (dal.ts, actions), el cliente (sidebar,
// pantalla de Usuarios) y los tests por igual.
//
// La RLS de Postgres repite estas mismas reglas con `private.has_module()`
// (ver supabase/migrations/20261020120000_usuarios_permisos.sql); si se
// agrega un módulo acá, también va en el check de esa migración.

export type AppRole = "admin" | "vendedor";

export const APP_MODULES = ["cotizacion", "costos", "planilla", "asistencia", "contratistas"] as const;

export type AppModule = (typeof APP_MODULES)[number];

/**
 * Sub-permisos: `asistencia` vive dentro de Planilla (Registro → Importar
 * asistencia) y `costos` dentro del Cotizador (precios y catálogo), así que
 * sin el módulo padre no hay forma de llegar a ellos.
 */
export const MODULE_PARENT: Partial<Record<AppModule, AppModule>> = {
  costos: "cotizacion",
  asistencia: "planilla",
};

export function isAppModule(value: unknown): value is AppModule {
  return typeof value === "string" && (APP_MODULES as readonly string[]).includes(value);
}

/**
 * Deja la lista de módulos limpia y en el orden de `APP_MODULES`: sin
 * repetidos, sin claves desconocidas y sin un sub-permiso cuyo módulo padre
 * no esté.
 */
export function normalizeModules(input: readonly unknown[]): AppModule[] {
  const set = new Set(input.filter(isAppModule));
  return APP_MODULES.filter((m) => {
    if (!set.has(m)) return false;
    const parent = MODULE_PARENT[m];
    return !parent || set.has(parent);
  });
}

export interface AccessSubject {
  role: AppRole | string | null | undefined;
  modules: readonly string[] | null | undefined;
}

/** El admin entra a todo; el resto solo a los módulos que tiene asignados. */
export function hasModule(subject: AccessSubject | null | undefined, module: AppModule): boolean {
  if (!subject) return false;
  if (subject.role === "admin") return true;
  return normalizeModules(subject.modules ?? []).includes(module);
}

/** Todos los módulos pedidos, no alguno. */
export function hasModules(subject: AccessSubject | null | undefined, modules: readonly AppModule[]): boolean {
  return modules.every((m) => hasModule(subject, m));
}

/** Al menos uno de los módulos pedidos (ej. Staff: Planilla o Contratistas). */
export function hasAnyModule(subject: AccessSubject | null | undefined, modules: readonly AppModule[]): boolean {
  return modules.some((m) => hasModule(subject, m));
}

/**
 * A dónde mandar a alguien al entrar (o cuando cae en un módulo que no
 * tiene): el primer módulo al que tiene acceso. Si no tiene ninguno, al
 * Dashboard, que hoy es una pantalla de "próximamente" abierta a todos — así
 * nunca hay un ciclo de redirecciones.
 */
export function homePathFor(subject: AccessSubject | null | undefined): string {
  if (hasModule(subject, "cotizacion")) return "/cotizacion";
  if (hasModule(subject, "planilla")) return "/planilla";
  if (hasModule(subject, "contratistas")) return "/contratistas";
  return "/dashboard";
}
