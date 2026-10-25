import type { PayrollEmployee, PayrollEntry } from "@/types/planilla";
import { computeRegistroSimpleTotals } from "./payroll-registro-totals";

/**
 * Modelo (sin dibujar) del resumen PDF de una quincena: una línea por
 * empleado con salario base, bonificaciones, descuentos, prestaciones,
 * cuota de préstamo y neto, más totales y un desglose por método de pago.
 * Puro y probado; el PDF solo lo dibuja.
 *
 *   neto = base + bonificaciones − descuentos + prestaciones − cuota
 *
 * Descuentos es solo asistencia (horas y días). La "cuota" junta lo del
 * estado de cuenta (préstamos, adelantos, daños…) con los otros descuentos
 * de la quincena, igual que la columna Préstamos y descuentos de la tabla.
 */
export interface QuincenaReportInput {
  employee: Pick<PayrollEmployee, "id" | "name">;
  entry: PayrollEntry | null;
  /** Abono a préstamos descontado en la quincena (sin otros descuentos: se suman aquí). */
  loanPaymentCents: number;
  /** Total que ya calcula la app (el neto). */
  netCents: number;
}

export interface QuincenaReportLine {
  employeeId: string;
  name: string;
  baseCents: number;
  bonificacionesCents: number;
  descuentosCents: number;
  prestacionesCents: number;
  loanPaymentCents: number;
  netCents: number;
  paid: boolean;
}

export interface QuincenaReport {
  lines: QuincenaReportLine[];
  totals: Omit<QuincenaReportLine, "employeeId" | "name" | "paid">;
  paidCount: number;
}

export function buildQuincenaReport(items: readonly QuincenaReportInput[]): QuincenaReport {
  const lines: QuincenaReportLine[] = items.map((i) => {
    const s = computeRegistroSimpleTotals(i.entry);
    return {
      employeeId: i.employee.id,
      name: i.employee.name,
      baseCents: s.baseCents,
      bonificacionesCents: s.bonificacionesCents,
      descuentosCents: s.descuentosCents,
      prestacionesCents: s.prestacionesCents,
      loanPaymentCents: i.loanPaymentCents + s.otrosDescuentosCents,
      netCents: i.netCents,
      paid: i.entry?.paid ?? false,
    };
  });

  const totals = lines.reduce(
    (t, l) => ({
      baseCents: t.baseCents + l.baseCents,
      bonificacionesCents: t.bonificacionesCents + l.bonificacionesCents,
      descuentosCents: t.descuentosCents + l.descuentosCents,
      prestacionesCents: t.prestacionesCents + l.prestacionesCents,
      loanPaymentCents: t.loanPaymentCents + l.loanPaymentCents,
      netCents: t.netCents + l.netCents,
      paid: false,
    }),
    { baseCents: 0, bonificacionesCents: 0, descuentosCents: 0, prestacionesCents: 0, loanPaymentCents: 0, netCents: 0, paid: false }
  );
  const { paid: _unused, ...totalsOut } = totals;
  void _unused;

  return {
    lines,
    totals: totalsOut,
    paidCount: lines.filter((l) => l.paid).length,
  };
}
