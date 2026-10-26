import type { PayrollEntry } from "@/types/planilla";

/**
 * Las cuatro sumas de la Vista Simple de Registro. Existe aparte de
 * `computePeriodTotalFromEntry` (la fuente de verdad del total) para que
 * la vista no repita la aritmética, y su test amarra que las cuatro sumas
 * y el total de la app no puedan separarse:
 *
 *   base + bonificaciones − descuentos − otros descuentos + prestaciones
 *     = total de la app + abono a préstamos del período
 *
 * (el abono de ledger baja el take-home pero no es ninguna de estas sumas
 * — ver `payroll-registro-totals.test.ts`). "Otros descuentos" va aparte
 * de la asistencia: en Quincena se muestra junto a préstamos y descuentos.
 */
export interface RegistroSimpleTotals {
  baseCents: number;
  /** Horas extra + días extra + viáticos + bonos + días libres. */
  bonificacionesCents: number;
  /** Asistencia: horas descontadas + días descontados (positivo: la
   *  vista lo resta). */
  descuentosCents: number;
  /** Otros descuentos de la quincena (positivo: la vista lo resta). */
  otrosDescuentosCents: number;
  /** Décimo + vacación + prima de antigüedad PAGADOS en la quincena. */
  prestacionesCents: number;
}

export function computeRegistroSimpleTotals(
  entry: Pick<
    PayrollEntry,
    | "basePayCents"
    | "extraHoursCents"
    | "extraDaysCents"
    | "viaticosCents"
    | "bonusCents"
    | "diasLibresCents"
    | "horasDescontadasCents"
    | "diasDescontadosCents"
    | "otherDeductionCents"
    | "decimoPaidCents"
    | "vacationPaidCents"
    | "primaAntiguedadPaidCents"
  > | null
): RegistroSimpleTotals {
  if (!entry) return { baseCents: 0, bonificacionesCents: 0, descuentosCents: 0, otrosDescuentosCents: 0, prestacionesCents: 0 };
  return {
    baseCents: entry.basePayCents,
    bonificacionesCents:
      entry.extraHoursCents + entry.extraDaysCents + entry.viaticosCents + entry.bonusCents + entry.diasLibresCents,
    descuentosCents: entry.horasDescontadasCents + entry.diasDescontadosCents,
    otrosDescuentosCents: entry.otherDeductionCents,
    prestacionesCents: entry.decimoPaidCents + entry.vacationPaidCents + entry.primaAntiguedadPaidCents,
  };
}
