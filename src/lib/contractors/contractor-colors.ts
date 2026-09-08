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
import type { ContractorLedgerDirection } from "@/types/contractors";

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
