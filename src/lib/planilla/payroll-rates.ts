import type { PayrollEmployee } from "@/types/planilla";

/**
 * Derivación de la tarifa por hora / por día, para auto-calcular Horas
 * Extras, Días Extras, Horas Descontadas y Días Descontados a partir de
 * una cantidad que entra el usuario, en vez de hacerle escribir un
 * monto en dólares a mano.
 *
 * Portado TAL CUAL de Atlas (Life OS) `src/lib/home/payroll-rates.ts`.
 * Las constantes salen de la hoja de referencia real ("Ebony - Planilla
 * 2026"): "Horas Quincena" = 120 (240/mes entre las dos quincenas) y
 * "Salario por Día" = salario mensual / 30 fijo, sin importar cuántos
 * días tenga el mes real — convención estándar de planilla en Panamá.
 * Si algún empleado futuro necesita otra jornada (medio tiempo, otras
 * horas/quincena), este es el único lugar donde hacerlo configurable.
 */
const HOURS_PER_MONTH = 240;
const DAYS_PER_MONTH = 30;

/** Centavos por hora, derivados del salario mensual del empleado. */
export function hourlyRateCents(employee: Pick<PayrollEmployee, "baseSalaryCents">): number {
  return employee.baseSalaryCents / HOURS_PER_MONTH;
}

/** Centavos por día, derivados del salario mensual del empleado. */
export function dailyRateCents(employee: Pick<PayrollEmployee, "baseSalaryCents">): number {
  return employee.baseSalaryCents / DAYS_PER_MONTH;
}

/** Redondea (cantidad de horas o días) x su tarifa a centavos enteros —
 *  las cantidades entran a centésimas (ej. 3.38 horas), así que el
 *  producto se redondea una vez acá en vez de quedar como float que
 *  podría driftar un centavo entre guardados repetidos. */
export function quantityToCents(quantity: number, rateCentsPerUnit: number): number {
  return Math.round(quantity * rateCentsPerUnit);
}
