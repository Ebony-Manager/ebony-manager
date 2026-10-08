import { describe, expect, it } from "vitest";

import type { LedgerCategory, PayrollLedgerEntry } from "@/types/planilla";
import { buildLoanStatement } from "./loan-statement";

let n = 0;
function e(
  category: LedgerCategory,
  direction: "debt" | "payment",
  amountCents: number,
  entryDate: string
): PayrollLedgerEntry {
  return { id: `e${++n}`, employeeId: "emp", category, direction, amountCents, entryDate, payrollEntryId: null, loanId: null, notes: null };
}
const NOW = { year: 2026, month: 3, half: 2 as const };

describe("buildLoanStatement", () => {
  it("sin movimientos -> todo en cero", () => {
    const s = buildLoanStatement([], NOW);
    expect(s.movements).toEqual([]);
    expect(s.totals).toEqual({ debtCents: 0, paymentCents: 0, balanceTodayCents: 0, balanceEndCents: 0 });
  });

  it("préstamo de 360 pagado en dos cuotas de 180: saldo corrido 360 -> 180 -> 0", () => {
    const s = buildLoanStatement(
      [e("prestamo", "payment", 18000, "2026-03-31"), e("prestamo", "debt", 36000, "2026-03-15"), e("prestamo", "payment", 18000, "2026-03-15")],
      NOW
    );
    expect(s.movements.map((m) => [m.direction, m.balanceCents])).toEqual([
      ["debt", 36000],
      ["payment", 18000],
      ["payment", 0],
    ]);
    expect(s.totals.debtCents).toBe(36000);
    expect(s.totals.paymentCents).toBe(36000);
    expect(s.totals.balanceEndCents).toBe(0);
  });

  it("el mismo día, lo otorgado va antes que lo descontado", () => {
    const s = buildLoanStatement([e("adelanto", "payment", 5000, "2026-01-31"), e("adelanto", "debt", 5000, "2026-01-31")], NOW);
    expect(s.movements.map((m) => m.direction)).toEqual(["debt", "payment"]);
  });

  it("cuotas futuras cuentan en el saldo al cierre pero no a hoy", () => {
    const s = buildLoanStatement([e("prestamo", "debt", 30000, "2026-03-15"), e("prestamo", "payment", 10000, "2026-04-15")], NOW);
    expect(s.totals.balanceTodayCents).toBe(30000);
    expect(s.totals.balanceEndCents).toBe(20000);
    expect(s.movements[1].occurred).toBe(false);
  });

  it("resumen por mes con saldo al cierre de cada mes", () => {
    const s = buildLoanStatement(
      [e("prestamo", "debt", 36000, "2026-01-15"), e("prestamo", "payment", 18000, "2026-01-31"), e("prestamo", "payment", 18000, "2026-02-15")],
      NOW
    );
    expect(s.monthly).toEqual([
      { year: 2026, month: 1, debtCents: 36000, paymentCents: 18000, balanceCents: 18000 },
      { year: 2026, month: 2, debtCents: 0, paymentCents: 18000, balanceCents: 0 },
    ]);
  });

  it("resumen por concepto; seguro_social se excluye", () => {
    const s = buildLoanStatement(
      [
        e("prestamo", "debt", 10000, "2026-01-15"),
        e("herramienta", "debt", 3000, "2026-01-15"),
        e("herramienta", "payment", 1000, "2026-01-31"),
        e("seguro_social", "debt", 9999, "2026-01-15"),
      ],
      NOW
    );
    expect(s.byCategory).toEqual([
      { category: "prestamo", debtCents: 10000, paymentCents: 0, balanceCents: 10000 },
      { category: "herramienta", debtCents: 3000, paymentCents: 1000, balanceCents: 2000 },
    ]);
    expect(s.totals.debtCents).toBe(13000);
  });

  it("saldo inicial de 2025 entra en el saldo corrido", () => {
    const s = buildLoanStatement([e("prestamo", "debt", 111700, "2025-12-31"), e("prestamo", "payment", 11700, "2026-01-15")], NOW);
    expect(s.movements[0].period).toEqual({ year: 2025, month: 12, half: 2 });
    expect(s.totals.balanceEndCents).toBe(100000);
  });
});
