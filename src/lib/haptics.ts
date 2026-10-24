/**
 * Vibración muy corta al tocar algo importante (pestañas de abajo, soltar para
 * refrescar), como en las apps del teléfono. Solo en pantallas táctiles y
 * donde el navegador lo permite (Android; el iPhone no deja vibrar a una web).
 */
export function haptic(ms = 8): void {
  if (typeof navigator === "undefined" || typeof window === "undefined") return;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Algunos navegadores lo bloquean sin interacción previa: no importa.
  }
}
