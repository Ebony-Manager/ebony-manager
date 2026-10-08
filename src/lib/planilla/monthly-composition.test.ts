import { describe, expect, it } from "vitest";

import type { PayrollEmployee, PayrollEntry } from "@/types/planilla";
import { computeLedgerBalanceToDate, computeMonthlyComposition, type EmployeeHistory, type LedgerRowFull } from "./payroll-reports";

function entry(id: string, month: number, half: 1 | 2, over: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id, employeeId: "emp", periodYear: 2026, periodMonth: month, periodHalf: half,
    basePayCents: 0, extraHours: 0, extraHoursCents: 0, extraDays: 0, extraDaysCents: 0, viaticosCents: 0,
    bonusCents: 0, diasLibresCents: 0, horasDescontadas: 0, horasDescontadasCents: 0, diasDescontados: 0,
    diasDescontadosCents: 0, otherDeductionCents: 0, decimoPaidCents: 0, vacationPaidCents: 0,
    primaAntiguedadPaidCents: 0, paymentMethod: "transferencia", paid: false, paidAt: null, notes: null, ...over,
  };
}
const EMP = { id: "emp", name: "X", status: "ACTIVE" } as unknown as PayrollEmployee;
const led = (direction: "debt" | "payment", amountCents: number, entryDate: string, payrollEntryId: string | null = null, category = "prestamo"): LedgerRowFull => ({
  category, direction, amountCents, entryDate, payrollEntryId,
});

describe("computeMonthlyComposition", () => {
  const history: EmployeeHistory = {
    employee: EMP,
    entries: [
      entry("a", 1, 1, { basePayCents: 47500, extraHoursCents: 1000, bonusCents: 500, horasDescontadasCents: 400 }),
      entry("b", 1, 2, { basePayCents: 47500, otherDeductionCents: 100 }),
    ],
    ledger: [led("debt", 6000, "2026-01-31", "b"), led("payment", 6000, "2026-01-31", "b")],
  };

  it("separa salario, extras, descuentos y cuotas, y deja el neto de la app", () => {
    const jan = computeMonthlyComposition([history], 2026)[0];
    expect(jan.salaryCents).toBe(95000);
    expect(jan.extrasCents).toBe(1500);
    expect(jan.deductionsCents).toBe(500);
    expect(jan.loanPaymentsCents).toBe(6000);
    expect(jan.loanGivenCents).toBe(6000);
    // 95000 + 1500 − 500 − 6000
    expect(jan.netCents).toBe(90000);
  });

  it("meses sin datos quedan en cero", () => {
    const feb = computeMonthlyComposition([history], 2026)[1];
    expect(feb).toMatchObject({ salaryCents: 0, extrasCents: 0, deductionsCents: 0, loanPaymentsCents: 0, netCents: 0 });
  });

  it("suma varios empleados", () => {
    const both = computeMonthlyComposition([history, history], 2026)[0];
    expect(both.salaryCents).toBe(190000);
  });
});

describe("computeLedgerBalanceToDate", () => {
  const NOW = { year: 2026, month: 3, half: 1 as const };
  it("un préstamo ya descontado en su totalidad no deja saldo, aunque la quincena no esté marcada pagada", () => {
    const ledger = [led("debt", 36000, "2026-01-15"), led("payment", 18000, "2026-01-31"), led("payment", 18000, "2026-02-15")];
    expect(computeLedgerBalanceToDate(ledger, NOW)).toBe(0);
  });
  it("las cuotas futuras todavía no restan", () => {
    const ledger = [led("debt", 30000, "2026-03-15"), led("payment", 10000, "2026-04-15")];
    expect(computeLedgerBalanceToDate(ledger, NOW)).toBe(30000);
  });
  it("seguro_social no cuenta", () => {
    expect(computeLedgerBalanceToDate([led("debt", 9999, "2026-01-15", null, "seguro_social")], NOW)).toBe(0);
  });
});
