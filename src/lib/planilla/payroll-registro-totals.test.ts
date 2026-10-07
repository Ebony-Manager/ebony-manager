import { describe, expect, it } from "vitest";

import type { PayrollEntry } from "@/types/planilla";
import { computePeriodTotalFromEntry } from "./payroll-accruals";
import { computeRegistroSimpleTotals } from "./payroll-registro-totals";

function makeEntry(over: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: "e-1",
    employeeId: "emp-1",
    periodYear: 2026,
    periodMonth: 3,
    periodHalf: 1,
    basePayCents: 0,
    extraHours: 0,
    extraHoursCents: 0,
    extraDays: 0,
    extraDaysCents: 0,
    viaticosCents: 0,
    bonusCents: 0,
    diasLibresCents: 0,
    horasDescontadas: 0,
    horasDescontadasCents: 0,
    diasDescontados: 0,
    diasDescontadosCents: 0,
    otherDeductionCents: 0,
    decimoPaidCents: 0,
    vacationPaidCents: 0,
    primaAntiguedadPaidCents: 0,
    paymentMethod: "transferencia",
    paid: false,
    paidAt: null,
    notes: null,
    ...over,
  };
}

/** salario + bonificaciones − descuentos + prestaciones. */
function fromSimple(e: PayrollEntry): number {
  const t = computeRegistroSimpleTotals(e);
  return t.baseCents + t.bonificacionesCents - t.descuentosCents + t.prestacionesCents;
}

describe("computeRegistroSimpleTotals", () => {
  it("sin entry -> todo en cero", () => {
    expect(computeRegistroSimpleTotals(null)).toEqual({
      baseCents: 0,
      bonificacionesCents: 0,
      descuentosCents: 0,
      prestacionesCents: 0,
    });
  });

  it("todo en cero -> las cuatro sumas y el total son 0", () => {
    const e = makeEntry();
    expect(computeRegistroSimpleTotals(e)).toEqual({
      baseCents: 0,
      bonificacionesCents: 0,
      descuentosCents: 0,
      prestacionesCents: 0,
    });
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("solo horas extra", () => {
    const e = makeEntry({ basePayCents: 25000, extraHours: 4, extraHoursCents: 3200 });
    expect(computeRegistroSimpleTotals(e)).toEqual({
      baseCents: 25000,
      bonificacionesCents: 3200,
      descuentosCents: 0,
      prestacionesCents: 0,
    });
    expect(fromSimple(e)).toBe(28200);
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("bonificaciones: suma horas extra, días extra, viáticos, bonos y días libres", () => {
    const e = makeEntry({
      basePayCents: 30000,
      extraHoursCents: 1000,
      extraDaysCents: 2000,
      viaticosCents: 500,
      bonusCents: 4000,
      diasLibresCents: 800,
    });
    expect(computeRegistroSimpleTotals(e).bonificacionesCents).toBe(8300);
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("con descuentos: horas, días y otros se restan", () => {
    const e = makeEntry({
      basePayCents: 30000,
      bonusCents: 2000,
      horasDescontadasCents: 1500,
      diasDescontadosCents: 4000,
      otherDeductionCents: 700,
    });
    expect(computeRegistroSimpleTotals(e).descuentosCents).toBe(6200);
    expect(fromSimple(e)).toBe(25800);
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("con décimo pagado (y vacación / prima)", () => {
    const e = makeEntry({
      basePayCents: 30000,
      decimoPaidCents: 20000,
      vacationPaidCents: 5000,
      primaAntiguedadPaidCents: 1200,
    });
    expect(computeRegistroSimpleTotals(e).prestacionesCents).toBe(26200);
    expect(fromSimple(e)).toBe(56200);
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("caso combinado: las cuatro sumas reproducen el total de la app", () => {
    const e = makeEntry({
      basePayCents: 41667,
      extraHoursCents: 2500,
      viaticosCents: 1500,
      diasLibresCents: 3000,
      horasDescontadasCents: 900,
      otherDeductionCents: 1100,
      decimoPaidCents: 15000,
    });
    expect(fromSimple(e)).toBe(computePeriodTotalFromEntry(e, { debt: 0, payment: 0 }).totalCents);
  });

  it("el abono a préstamos del período es lo único que separa las cuatro sumas del total", () => {
    const e = makeEntry({ basePayCents: 30000, bonusCents: 1000 });
    const total = computePeriodTotalFromEntry(e, { debt: 0, payment: 5000 }).totalCents;
    expect(fromSimple(e) - 5000).toBe(total);
  });
});
