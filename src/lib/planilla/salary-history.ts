/**
 * Historial de sueldos — el ÚNICO lugar que manda sobre el sueldo de un
 * empleado. Cada `SalaryChange` fija el sueldo mensual vigente desde una
 * quincena (año/mes/mitad). El sueldo de una quincena dada es la fila
 * más reciente cuya quincena efectiva sea `<=` esa quincena.
 *
 * `payroll_employees.base_salary_cents` / `benefits_base_salary_cents`
 * son solo un REFLEJO recalculado del sueldo vigente hoy — nunca una
 * segunda versión editable a mano. Toda la verdad vive acá.
 *
 * Puro, sin capa de datos: recibe el array ya cargado.
 */
import { periodOrdinal } from "@/lib/planilla/payroll-period";

export interface SalaryChange {
  monthlySalaryCents: number;
  /** Base alterna para prestaciones (Décimo/Vacación/Prima) en este
   *  tramo de vigencia. null = igual a `monthlySalaryCents`. */
  benefitsBaseSalaryCents: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveHalf: 1 | 2;
}

function ord(c: Pick<SalaryChange, "effectiveYear" | "effectiveMonth" | "effectiveHalf">): number {
  return periodOrdinal(c.effectiveYear, c.effectiveMonth, c.effectiveHalf);
}

/** El sueldo vigente en la quincena (year, month, half): la fila más
 *  reciente con fecha efectiva `<=` esa quincena. `null` si la quincena
 *  es anterior a cualquier cambio registrado. */
export function salaryInEffect(
  changes: SalaryChange[],
  year: number,
  month: number,
  half: 1 | 2
): SalaryChange | null {
  const target = periodOrdinal(year, month, half);
  let best: SalaryChange | null = null;
  let bestOrd = -Infinity;
  for (const c of changes) {
    const o = ord(c);
    if (o <= target && o > bestOrd) {
      best = c;
      bestOrd = o;
    }
  }
  return best;
}

/** La fila más antigua del historial (el sueldo inicial). `null` si no
 *  hay historial. */
export function earliestSalary(changes: SalaryChange[]): SalaryChange | null {
  let best: SalaryChange | null = null;
  let bestOrd = Infinity;
  for (const c of changes) {
    const o = ord(c);
    if (o < bestOrd) {
      best = c;
      bestOrd = o;
    }
  }
  return best;
}

/** El sueldo mensual vigente en una quincena, con fallback al sueldo
 *  inicial cuando la quincena precede a todo el historial (ej. una
 *  quincena anterior al ingreso). 0 si no hay historial. */
export function monthlySalaryAt(
  changes: SalaryChange[],
  year: number,
  month: number,
  half: 1 | 2
): number {
  const c = salaryInEffect(changes, year, month, half) ?? earliestSalary(changes);
  return c ? c.monthlySalaryCents : 0;
}

/** La base para prestaciones vigente en una quincena (con el mismo
 *  fallback). `null` si no hay una base alterna (se usa el sueldo). */
export function benefitsBaseAt(
  changes: SalaryChange[],
  year: number,
  month: number,
  half: 1 | 2
): number | null {
  const c = salaryInEffect(changes, year, month, half) ?? earliestSalary(changes);
  return c ? c.benefitsBaseSalaryCents : null;
}

/** La quincena base por defecto: sueldo mensual vigente ÷ 2, redondeado
 *  a centavos enteros. */
export function quincenaBaseCentsAt(
  changes: SalaryChange[],
  year: number,
  month: number,
  half: 1 | 2
): number {
  return Math.round(monthlySalaryAt(changes, year, month, half) / 2);
}
