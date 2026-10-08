/**
 * "Mi vista" de las pantallas de Planilla (Registro y Auditoría): la
 * combinación de columnas / secciones / paleta / nivel de detalle que el
 * usuario guarda para que sea la que se abra por defecto.
 *
 * - Se guarda por pantalla en localStorage con clave versionada
 *   (`ebony:planilla-registro-vista-v1`, `ebony:planilla-auditoria-vista-v1`).
 *   Si más adelante se quiere en la base de datos es otra tarea.
 * - TODO acceso a localStorage va en try/catch (modo privado, cuota llena,
 *   SSR): nunca debe romper la pantalla.
 * - `sessionView` es una memoria EN EL MÓDULO: sobrevive a cambiar de
 *   pestaña dentro de Planilla (las pantallas se desmontan al cambiar de
 *   tab) pero NO a recargar la página, así al recargar siempre se abre
 *   "mi vista" (o la original si no hay).
 */

export const REGISTRO_VIEW_KEY = "ebony:planilla-registro-vista-v1";
export const AUDITORIA_VIEW_KEY = "ebony:planilla-auditoria-vista-v1";
export const SAVED_VIEW_VERSION = 1;

/** Lee y valida lo guardado. `sanitize` recibe el objeto crudo y devuelve
 *  la vista ya validada (rellenando con defaults lo que falte o venga
 *  corrupto), o null si no sirve. Cualquier error -> null. */
export function parseSavedView<T>(
  raw: string | null,
  sanitize: (obj: Record<string, unknown>) => T | null
): T | null {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
    const rec = obj as Record<string, unknown>;
    if (rec.v !== SAVED_VIEW_VERSION) return null;
    return sanitize(rec);
  } catch {
    return null;
  }
}

export function readSavedView<T>(key: string, sanitize: (obj: Record<string, unknown>) => T | null): T | null {
  try {
    return parseSavedView(window.localStorage.getItem(key), sanitize);
  } catch {
    return null;
  }
}

/** true si se pudo guardar. */
export function writeSavedView(key: string, value: object): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: SAVED_VIEW_VERSION, ...value }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedView(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ── validadores pequeños para armar `sanitize` ──────────────────────────

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Record<clave, boolean> con TODAS las claves de `defaults`: lo guardado
 *  pisa solo lo que sea booleano; claves desconocidas se ignoran, claves
 *  nuevas (columnas agregadas después) toman su default. */
export function pickBoolRecord<K extends string>(value: unknown, defaults: Record<K, boolean>): Record<K, boolean> {
  const out = { ...defaults };
  if (typeof value === "object" && value !== null) {
    for (const k of Object.keys(defaults) as K[]) {
      const v = (value as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

// ── memoria de sesión (módulo) ──────────────────────────────────────────

const session = new Map<string, unknown>();
export const sessionView = {
  get<T>(key: string): T | undefined {
    return session.get(key) as T | undefined;
  },
  set(key: string, value: unknown): void {
    session.set(key, value);
  },
  clear(key: string): void {
    session.delete(key);
  },
};
