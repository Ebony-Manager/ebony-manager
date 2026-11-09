/**
 * ¿Un evento SIGNED_IN del navegador es de verdad otra persona entrando?
 *
 * Supabase lanza SIGNED_IN cada vez que una pestaña se carga o vuelve a
 * estar visible (recupera la sesión guardada), y lo reenvía a TODAS las
 * pestañas abiertas. Recargar la página por cada uno hacía que, con dos
 * cotizaciones abiertas, las dos se recargaran completas (≈22 consultas cada
 * una) cada vez que se cambiaba de pestaña: el "parpadeo" y ~40% del tráfico
 * de un día de cotizar. Solo hace falta recargar si cambió la cuenta.
 */
export function isDifferentAccount(currentEmail: string | null | undefined, sessionEmail: string | null | undefined): boolean {
  const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
  return norm(currentEmail) !== norm(sessionEmail);
}
