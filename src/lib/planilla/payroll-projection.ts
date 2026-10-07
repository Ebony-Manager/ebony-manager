import { currentPeriod, periodOrdinal, type Period } from "./payroll-period";

/**
 * ¿Ya ocurrió (o está en curso) esa quincena? La quincena actual cuenta
 * como ocurrida — ya empezó. Se compara por `periodOrdinal`, así un año
 * pasado queda todo ocurrido y uno futuro todo proyectado sin casos
 * especiales.
 */
export function isPeriodOccurred(
  year: number,
  month: number,
  half: 1 | 2,
  now: Period = currentPeriod()
): boolean {
  return periodOrdinal(year, month, half) <= periodOrdinal(now.year, now.month, now.half);
}

/** Un mes (vista Macro de Auditoría) cuenta como ocurrido si su primera
 *  quincena ya empezó. */
export function isMonthOccurred(year: number, month: number, now: Period = currentPeriod()): boolean {
  return isPeriodOccurred(year, month, 1, now);
}
