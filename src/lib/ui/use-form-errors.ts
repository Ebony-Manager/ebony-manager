import * as React from "react";

/**
 * Validación de formularios (ver UI-RULES.md): al tocar Guardar se revisan
 * TODOS los campos a la vez; los que fallan se marcan en rojo con su mensaje
 * debajo (`<Field error={error("name")}>`), la pantalla baja al primero y el
 * error se quita cuando la persona corrige ese campo (`clear`).
 *
 *   const { error, validate, clear } = useFormErrors<"name" | "who">();
 *   if (!validate([["name", !form.name.trim(), tv("name_required")], ["who", !form.a && !form.b, tv("someone_required")]])) return;
 *
 * Lo que no se pudo guardar por el servidor NO va acá: va en un aviso (toast).
 */
export function useFormErrors<K extends string>() {
  const [errors, setErrors] = React.useState<Partial<Record<K, string>>>({});
  const [focusTick, setFocusTick] = React.useState(0);

  // Después de pintar los errores: baja al primer campo marcado y lo enfoca.
  React.useEffect(() => {
    if (!focusTick) return;
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus?.({ preventScroll: true });
  }, [focusTick]);

  /** Cada regla es [campo, ¿falla?, mensaje]. Devuelve true si no falla ninguna. */
  const validate = React.useCallback((rules: readonly (readonly [K, boolean, string])[]): boolean => {
    const next: Partial<Record<K, string>> = {};
    for (const [key, fails, message] of rules) if (fails) next[key] = message;
    setErrors(next);
    const ok = Object.keys(next).length === 0;
    if (!ok) setFocusTick((n) => n + 1);
    return ok;
  }, []);

  const clear = React.useCallback((key: K) => setErrors((e) => (key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) as Partial<Record<K, string>> : e)), []);
  const reset = React.useCallback(() => setErrors({}), []);
  const error = React.useCallback((key: K) => errors[key], [errors]);

  return { errors, error, validate, clear, reset };
}
