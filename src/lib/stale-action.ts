/**
 * La página quedó abierta mientras se publicó una versión nueva de la app: el navegador llama a una acción
 * del servidor que ya no existe ("Server Action … was not found on the server"). Se arregla recargando.
 * Para no perder lo que se estaba escribiendo, quien guarda solo (como la cotización) deja una copia en el
 * navegador antes de recargar y la vuelve a aplicar al abrir.
 */
export function isStaleActionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /server action .* was not found|failed to find server action/i.test(msg);
}

/** Guarda una copia local (se borra al recuperarla). Sin almacenamiento del navegador, no hace nada. */
export function stashDraft(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* sin almacenamiento: se pierde el último cambio */
  }
}

/** Lee y borra la copia local (si tiene menos de un día). */
export function takeDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    window.localStorage.removeItem(key);
    const parsed = JSON.parse(raw) as { at: number; value: T };
    return Date.now() - parsed.at < 24 * 3600 * 1000 ? parsed.value : null;
  } catch {
    return null;
  }
}
