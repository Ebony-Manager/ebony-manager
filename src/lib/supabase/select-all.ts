/**
 * Supabase devuelve como MÁXIMO 1,000 filas por consulta y no avisa cuando
 * corta: un `select("*")` sobre una tabla grande entrega solo las primeras
 * 1,000 y los totales salen mal en silencio (le pasó al directorio de
 * Contratistas al pasar de 1,000 movimientos). Toda lectura de "todas las
 * filas" debe pasar por acá: pide páginas de 1,000 (ordenadas por una
 * columna estable, para que las páginas no se pisen) hasta agotar la tabla.
 *
 * Uso: `await selectAllRows((from, to) => supabase.from("t").select("*").order("id").range(from, to))`
 */
const PAGE_SIZE = 1000;

export async function selectAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}
