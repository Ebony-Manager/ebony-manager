import { describe, expect, it } from "vitest";

import type { PayrollEntry } from "@/types/planilla";
import type { AnnualDetailRow } from "./payroll-accruals";
import { buildEmployeeStatement, statementTotals } from "./employee-statement";

function entry(over: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: "e", employeeId: "emp", periodYear: 2026, periodMonth: 1, periodHalf: 1,
    basePayCents: 0, extraHours: 0, extraHoursCents: 0, extraDays: 0, extraDaysCents: 0, viaticosCents: 0,
    bonusCents: 0, diasLibresCents: 0, horasDescontadas: 0, horasDescontadasCents: 0, diasDescontados: 0,
    diasDescontadosCents: 0, otherDeductionCents: 0, decimoPaidCents: 0, vacationPaidCents: 0,
    primaAntiguedadPaidCents: 0, paymentMethod: "transferencia", paid: false, paidAt: null, notes: null, ...over,
  };
}
function row(month: number, half: 1 | 2, o: Partial<AnnualDetailRow> & { e?: Partial<PayrollEntry> | null } = {}): AnnualDetailRow {
  const { e, ...rest } = o;
  return {
    year: 2026, month, half,
    entry: e === null ? null : entry({ periodMonth: month, periodHalf: half, ...(e ?? {}) }),
    ledgerDebtCents: 0, ledgerPaymentCents: 0, totalCents: 0, runningLedgerBalanceCents: 0,
    decimoAccrualCents: 0, vacationAccrualCents: 0, decimoAccrualBenefitsCents: null,
    vacationAccrualBenefitsCents: null, primaAntiguedadAccrualCents: 0, ...rest,
  } as AnnualDetailRow;
}
const NOW = { year: 2026, month: 2, half: 1 as const };

const ROWS = [
  row(1, 1, { e: { basePayCents: 47500, extraHoursCents: 1338, horasDescontadasCents: 435, paid: true }, totalCents: 48403 }),
  row(1, 2, { e: { basePayCents: 47500, bonusCents: 4496, paid: true }, ledgerDebtCents: 6000, ledgerPaymentCents: 6000, totalCents: 46000, runningLedgerBalanceCents: 0 }),
  row(2, 1, { e: { basePayCents: 47500, paid: true }, ledgerDebtCents: 36000, ledgerPaymentCents: 18000, totalCents: 29500, runningLedgerBalanceCents: 18000 }),
  // Ya empezó (NOW) pero no se ha cerrado ni pagado.
  row(2, 2, { e: { basePayCents: 47500 }, totalCents: 47500, runningLedgerBalanceCents: 18000 }),
  row(3, 1, { e: null }),
];

describe("buildEmployeeStatement", () => {
  it("por quincena: una fila por quincena con datos, con sus columnas", () => {
    const s = buildEmployeeStatement(ROWS, "quincena", NOW);
    expect(s).toHaveLength(4);
    expect(s[0]).toMatchObject({ salaryCents: 47500, bonusCents: 1338, deductionCents: 435, netCents: 48403, occurred: true });
    expect(s[1]).toMatchObject({ bonusCents: 4496, loanGivenCents: 6000, loanPaidCents: 6000, loanBalanceCents: 0 });
    expect(s[3].occurred).toBe(false);
  });

  it("por mes: suma las quincenas pagadas y toma el saldo de la última", () => {
    const s = buildEmployeeStatement(ROWS, "month", NOW);
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({ month: 1, half: null, salaryCents: 95000, bonusCents: 5834, deductionCents: 435, loanGivenCents: 6000, loanPaidCents: 6000, netCents: 94403 });
    expect(s[1]).toMatchObject({ month: 2, half: null, loanGivenCents: 36000, loanPaidCents: 18000, loanBalanceCents: 18000, netCents: 29500, occurred: true });
  });

  it("una quincena que ya empezó pero no se ha pagado no cuenta: va aparte, en gris", () => {
    const s = buildEmployeeStatement(ROWS, "month", NOW);
    expect(s[2]).toMatchObject({ month: 2, half: 2, netCents: 47500, occurred: false });
    // Préstamo con cuota en la quincena abierta: la cuota no baja el saldo todavía.
    const open = buildEmployeeStatement([row(10, 2, { e: { paid: false }, ledgerPaymentCents: 27000 })], "quincena", { year: 2026, month: 10, half: 2 });
    expect(open[0].occurred).toBe(false);
    expect(statementTotals(open).loanPaidCents).toBe(0);
  });

  it("quincenas sin entrada ni préstamo no aparecen", () => {
    expect(buildEmployeeStatement([row(5, 1, { e: null })], "quincena", NOW)).toEqual([]);
  });

  it("una quincena solo con movimiento de préstamo sí aparece", () => {
    const s = buildEmployeeStatement([row(5, 1, { e: null, ledgerPaymentCents: 1000, runningLedgerBalanceCents: -1000 })], "quincena", NOW);
    expect(s).toHaveLength(1);
    expect(s[0].loanPaidCents).toBe(1000);
  });
});

describe("statementTotals", () => {
  it("suma solo lo ocurrido por defecto", () => {
    const s = buildEmployeeStatement(ROWS, "quincena", NOW);
    expect(statementTotals(s).netCents).toBe(48403 + 46000 + 29500);
    expect(statementTotals(s, false).netCents).toBe(48403 + 46000 + 29500 + 47500);
  });
});
