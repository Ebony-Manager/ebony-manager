/**
 * Color semántico del estado de cuenta de Contratistas. Ningún color
 * literal vive acá: solo devuelve strings `var(--…)` de tokens de tema
 * de Ebony (`--success`, `--destructive`, `--muted-foreground`), igual
 * que `src/lib/planilla/payroll-colors.ts`.
 *
 *   a_favor  → sube el saldo (verde de marca)
 *   reduce   → baja el saldo (rojo de marca)
 *   neutral  → 0 / material que Ebony asume (gris)
 */
import type { ContractorLedgerCategory, ContractorLedgerDirection } from "@/types/contractors";

export type BalanceTone = ContractorLedgerDirection | "neutral";

const TONE_VAR: Record<BalanceTone, string> = {
  a_favor: "var(--success)",
  reduce: "var(--destructive)",
  neutral: "var(--muted-foreground)",
};

export function toneVar(tone: BalanceTone): string {
  return TONE_VAR[tone];
}

/** Tono de un saldo por su signo. */
export function balanceTone(cents: number): BalanceTone {
  if (cents > 0) return "a_favor";
  if (cents < 0) return "reduce";
  return "neutral";
}

export function toneTextStyle(tone: BalanceTone): React.CSSProperties {
  return { color: TONE_VAR[tone] };
}

/** Fondo tenue teñido para una fila del estado de cuenta — misma técnica
 *  `color-mix` que Registro de Planilla. `neutral` no tiñe. */
export function toneRowTint(tone: BalanceTone, opacity = 5): React.CSSProperties {
  if (tone === "neutral") return {};
  return { backgroundColor: `color-mix(in oklch, ${TONE_VAR[tone]} ${opacity}%, transparent)` };
}

/** Fondo de una fila del estado de cuenta combinando el tinte
 *  ingreso/egreso con un realce de hover. El tinte inline gana sobre
 *  cualquier clase `hover:bg-*`, así que el hover se resuelve acá. */
export function toneRowBackground(tone: BalanceTone, hovered: boolean): React.CSSProperties {
  const tint = tone === "neutral" ? "transparent" : `color-mix(in oklch, ${TONE_VAR[tone]} 5%, transparent)`;
  if (!hovered) return tone === "neutral" ? {} : { backgroundColor: tint };
  return { backgroundColor: `color-mix(in oklch, var(--foreground) 6%, ${tint})` };
}

/** Igual que `toneRowBackground` pero OPACO (mezcla sobre `--background`),
 *  para la celda congelada de la izquierda: al hacer scroll horizontal el
 *  contenido no debe traslucirse por debajo. */
export function toneStickyBackground(tone: BalanceTone, hovered: boolean): React.CSSProperties {
  let bg = tone === "neutral" ? "var(--background)" : `color-mix(in oklch, ${TONE_VAR[tone]} 5%, var(--background))`;
  if (hovered) bg = `color-mix(in oklch, var(--foreground) 6%, ${bg})`;
  return { backgroundColor: bg };
}

/**
 * Color de la CATEGORÍA del movimiento (como la hoja de Excel del dueño):
 *
 *   Proyecto (trabajo)        → gris
 *   Compra de material        → azul
 *   Abono / Pago              → verde
 *   Préstamo                  → amarillo
 *   Las demás                 → sin color (neutro, texto normal)
 *
 * Es un eje independiente del tinte de fila ingreso/egreso. Devuelve un
 * string `var(--…)` de token, o `null` para las categorías neutras.
 */
const CATEGORY_COLOR_VAR: Partial<Record<ContractorLedgerCategory, string>> = {
  trabajo: "var(--contractor-cat-proyecto)",
  material: "var(--contractor-cat-material)",
  pago: "var(--contractor-cat-pago)",
  prestamo: "var(--contractor-cat-prestamo)",
};

export function categoryColorVar(category: ContractorLedgerCategory): string | null {
  return CATEGORY_COLOR_VAR[category] ?? null;
}

/** Estilo de "chip" para la etiqueta de categoría: su color de texto
 *  sobre un fondo teñido. `null` para categorías neutras (se muestran
 *  como texto normal, sin chip). */
export function categoryChipStyle(category: ContractorLedgerCategory): React.CSSProperties | null {
  const v = categoryColorVar(category);
  if (!v) return null;
  return { color: v, backgroundColor: `color-mix(in oklch, ${v} 14%, transparent)` };
}
