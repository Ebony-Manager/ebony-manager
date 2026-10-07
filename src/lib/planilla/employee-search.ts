/**
 * Búsqueda y numeración de empleados para las tablas de Registro y
 * Auditoría. Puro y compartido, así las dos pantallas buscan igual.
 */

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** ¿El nombre contiene TODAS las palabras de la búsqueda? Sin importar
 *  mayúsculas ni acentos ni el orden ("loaiza mario" encuentra "Mario
 *  Loaiza"). Búsqueda vacía -> todos. */
export function matchesEmployeeQuery(name: string, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fold(name);
  return tokens.every((t) => haystack.includes(t));
}

/** Número de cada empleado = su posición (1, 2, 3…) en la lista COMPLETA
 *  y ordenada, calculado ANTES de buscar o filtrar: así "Mario Loaiza" es
 *  el 36 aunque la búsqueda lo deje solo en pantalla. */
export function numberEmployees(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i + 1]));
}
