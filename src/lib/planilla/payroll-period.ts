/**
 * Helpers de período (quincena) para la Planilla — etiquetas de mes en
 * español hardcodeadas en vez de Intl/toLocaleDateString, mismo motivo
 * de hidratación servidor/cliente que el resto del formateo de fechas.
 *
 * Portado TAL CUAL de Atlas (Life OS) `src/lib/home/payroll-period.ts`
 * — aritmética pura de quincenas, sin capa de datos. `previousPeriod`
 * vivía en el `services/payroll.ts` (server-only) de Atlas; acá va junto
 * al resto de la matemática de períodos para que la capa de cálculos no
 * dependa del servicio.
 */
export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** "month-half" — la clave donde un período necesita direccionar una
 *  sola celda de un mapa (columnas de Resumen Anual, "duplicar
 *  quincena anterior"). */
export function periodKey(month: number, half: 1 | 2): string {
  return `${month}-${half}`;
}

export function currentPeriod(): { year: number; month: number; half: 1 | 2 } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, half: now.getDate() <= 15 ? 1 : 2 };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface Period {
  year: number;
  month: number;
  half: 1 | 2;
}

/** Un solo número creciente por quincena, así "¿A va antes/después de
 *  B?" es una comparación en vez de tres — se usa donde una fórmula
 *  necesita caminar hacia adelante/atrás cruzando fronteras de mes/año
 *  (ventanas de N quincenas, "desde el último pago", "todavía no pasó"). */
export function periodOrdinal(year: number, month: number, half: 1 | 2): number {
  return year * 24 + (month - 1) * 2 + (half - 1);
}

/** La quincena justo después de `p`, cruzando fronteras de mes/año — el
 *  incremento que necesita cada recorrido de segmento en las fórmulas
 *  de acumulado (segmentos fijos de décimo, suma de vacación desde el
 *  último pago). */
export function nextPeriod(p: Period): Period {
  return p.half === 1
    ? { year: p.year, month: p.month, half: 2 }
    : { year: p.month === 12 ? p.year + 1 : p.year, month: p.month === 12 ? 1 : p.month + 1, half: 1 };
}

/** La quincena inmediatamente anterior a la dada — cruza la frontera de
 *  año (la "anterior" a la 1a quincena de enero es la 2a de diciembre
 *  del año previo). Alimenta "Duplicar quincena anterior". */
export function previousPeriod(year: number, month: number, half: 1 | 2): { year: number; month: number; half: 1 | 2 } {
  if (half === 2) return { year, month, half: 1 };
  if (month === 1) return { year: year - 1, month: 12, half: 2 };
  return { year, month: month - 1, half: 2 };
}
