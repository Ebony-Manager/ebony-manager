import { describe, expect, it } from "vitest";

import type { PayrollEntry } from "@/types/planilla";
import { buildQuincenaReport } from "./quincena-report";

function entry(over: Partial<PayrollEntry>): PayrollEntry {
  return {
    id: "e", employeeId: "x", periodYear: 2026, periodMonth: 1, periodHalf: 2,
    basePayCents: 0, extraHours: 0, extraHoursCents: 0, extraDays: 0, extraDaysCents: 0, viaticosCents: 0,
    bonusCents: 0, diasLibresCents: 0, horasDescontadas: 0, horasDescontadasCents: 0, diasDescontados: 0,
    diasDescontadosCents: 0, otherDeductionCents: 0, decimoPaidCents: 0, vacationPaidCents: 0,
    primaAntiguedadPaidCents: 0, paymentMethod: "transferencia", paid: false, paidAt: null, notes: null, ...over,
  };
}

describe("buildQuincenaReport", () => {
  const report = buildQuincenaReport([
    {
      employee: { id: "1", name: "Jose Salcedo" },
      entry: entry({ basePayCents: 47500, extraHoursCents: 11210, bonusCents: 4496, horasDescontadasCents: 412, paid: true }),
      loanPaymentCents: 6000,
      netCents: 56794,
    },
    { employee: { id: "2", name: "Joseph Guevara" }, entry: entry({ basePayCents: 37500, paymentMethod: "efectivo" }), loanPaymentCents: 0, netCents: 37500 },
    { employee: { id: "3", name: "Sin quincena" }, entry: null, loanPaymentCents: 0, netCents: 0 },
  ]);

  it("cada línea cuadra: base + bonificaciones − descuentos + prestaciones − cuota = neto", () => {
    for (const l of report.lines) {
      expect(l.baseCents + l.bonificacionesCents - l.descuentosCents + l.prestacionesCents - l.loanPaymentCents).toBe(l.netCents);
    }
    expect(report.lines[0]).toMatchObject({ baseCents: 47500, bonificacionesCents: 15706, descuentosCents: 412, loanPaymentCents: 6000, netCents: 56794 });
  });

  it("totales", () => {
    expect(report.totals.netCents).toBe(94294);
    expect(report.totals.loanPaymentCents).toBe(6000);
    expect(report.paidCount).toBe(1);
  });

  it("sin quincena registrada: todo en cero", () => {
    expect(report.lines[2]).toMatchObject({ baseCents: 0, netCents: 0, paid: false });
  });
});
