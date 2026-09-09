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

/**
 * Color de la CATEGORÍA del movimiento (como la hoja de Excel del dueño):
 *
 *   Proyecto (trabajo)        → gris
 *   Compra de material        → azul
 *   Abono / Pago              → verde
 *   Préstamo                  → amarillo
 *   Las demás                 → sin color (neutro)
 *
 * En la C2 este color pinta la FILA ENTERA y manda sobre el sentido
 * ingreso/egreso (que ya se ve en las columnas "A favor" / "Reduce").
 * Devuelve un string `var(--…)` de token, o `null` para categorías
 * neutras.
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

/** Texto de la etiqueta de categoría en su color (o sin estilo si la
 *  categoría es neutra). */
export function categoryTextStyle(category: ContractorLedgerCategory): React.CSSProperties | undefined {
  const v = categoryColorVar(category);
  return v ? { color: v } : undefined;
}

/**
 * Fondo de una fila del estado de cuenta, teñido por el color de la
 * CATEGORÍA (no por ingreso/egreso). El tinte inline gana sobre cualquier
 * clase `hover:bg-*`, así que el realce de hover se resuelve acá también.
 * Categoría neutra → sin tinte (solo hover).
 */
export function categoryRowBackground(
  category: ContractorLedgerCategory,
  hovered: boolean
): React.CSSProperties {
  const v = categoryColorVar(category);
  const tint = v ? `color-mix(in oklch, ${v} 9%, transparent)` : "transparent";
  if (!hovered) return v ? { backgroundColor: tint } : {};
  return { backgroundColor: `color-mix(in oklch, var(--foreground) 6%, ${tint})` };
}

/** Igual que `categoryRowBackground` pero OPACO (mezcla sobre
 *  `--background`), para la celda congelada de la izquierda: al hacer
 *  scroll horizontal el contenido no debe traslucirse por debajo. */
export function categoryStickyBackground(
  category: ContractorLedgerCategory,
  hovered: boolean
): React.CSSProperties {
  const v = categoryColorVar(category);
  let bg = v ? `color-mix(in oklch, ${v} 9%, var(--background))` : "var(--background)";
  if (hovered) bg = `color-mix(in oklch, var(--foreground) 6%, ${bg})`;
  return { backgroundColor: bg };
}
