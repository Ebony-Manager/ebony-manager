import type { LedgerCategory, PayrollLedgerEntry } from "@/types/planilla";
import { periodFromDateString } from "./payroll-accruals";
import type { Period } from "./payroll-period";
import { isPeriodOccurred } from "./payroll-projection";

/**
 * Estado de cuenta de préstamos / adelantos / herramientas / daños de UN
 * empleado, armado desde su ledger: cada movimiento con el saldo corrido,
 * el resumen por mes y el resumen por concepto. Puro (sin red) para poder
 * probarlo.
 *
 * - `seguro_social` queda fuera: es informativo, nunca baja lo que se le
 *   paga a la persona (igual criterio que el cálculo de totales).
 * - Los movimientos de quincenas que todavía no han ocurrido (cuotas ya
 *   programadas) cuentan en el saldo "al cierre", pero no en el saldo "a
 *   hoy" — `occurred` los distingue.
 */
export interface LoanMovement {
  id: string;
  date: string;
  period: Period;
  category: LedgerCategory;
  direction: "debt" | "payment";
  amountCents: number;
  /** Saldo después de este movimiento (deuda − cuotas, en orden de fecha). */
  balanceCents: number;
  occurred: boolean;
}

export interface LoanMonthRow {
  year: number;
  month: number;
  debtCents: number;
  paymentCents: number;
  /** Saldo al cierre de ese mes. */
  balanceCents: number;
}

export interface LoanCategoryRow {
  category: LedgerCategory;
  debtCents: number;
  paymentCents: number;
  balanceCents: number;
}

export interface LoanStatement {
  movements: LoanMovement[];
  monthly: LoanMonthRow[];
  byCategory: LoanCategoryRow[];
  totals: {
    debtCents: number;
    paymentCents: number;
    /** Saldo a hoy: lo otorgado hasta hoy menos las cuotas de quincenas ya pagadas. */
    balanceTodayCents: number;
    /** Saldo contando también las cuotas ya programadas a futuro. */
    balanceEndCents: number;
  };
}

export function buildLoanStatement(entries: readonly PayrollLedgerEntry[], now: Period): LoanStatement {
  const rows = entries
    .filter((e) => e.category !== "seguro_social")
    .map((e) => ({ e, period: periodFromDateString(e.entryDate) }))
    .filter((r): r is { e: PayrollLedgerEntry; period: Period } => r.period !== null)
    // Por fecha; el mismo día, primero lo otorgado y luego lo descontado.
    .sort(
      (a, b) =>
        a.e.entryDate.localeCompare(b.e.entryDate) ||
        (a.e.direction === b.e.direction ? 0 : a.e.direction === "debt" ? -1 : 1) ||
        a.e.id.localeCompare(b.e.id)
    );

  let balance = 0;
  let balanceToday = 0;
  let debtTotal = 0;
  let paymentTotal = 0;
  const movements: LoanMovement[] = rows.map(({ e, period }) => {
    const sign = e.direction === "debt" ? 1 : -1;
    balance += sign * e.amountCents;
    // Una cuota cuenta solo cuando su quincena se cerró y se marcó pagada; lo
    // otorgado (y un abono suelto, sin quincena) desde su fecha.
    const occurred =
      e.direction === "payment" && e.payrollEntryId && e.paid != null
        ? e.paid
        : isPeriodOccurred(period.year, period.month, period.half, now);
    if (occurred) balanceToday += sign * e.amountCents;
    if (e.direction === "debt") debtTotal += e.amountCents;
    else paymentTotal += e.amountCents;
    return {
      id: e.id,
      date: e.entryDate,
      period,
      category: e.category,
      direction: e.direction,
      amountCents: e.amountCents,
      balanceCents: balance,
      occurred,
    };
  });

  const monthly: LoanMonthRow[] = [];
  for (const m of movements) {
    let row = monthly[monthly.length - 1];
    if (!row || row.year !== m.period.year || row.month !== m.period.month) {
      row = { year: m.period.year, month: m.period.month, debtCents: 0, paymentCents: 0, balanceCents: 0 };
      monthly.push(row);
    }
    if (m.direction === "debt") row.debtCents += m.amountCents;
    else row.paymentCents += m.amountCents;
    row.balanceCents = m.balanceCents;
  }

  const catMap = new Map<LedgerCategory, LoanCategoryRow>();
  for (const m of movements) {
    const row = catMap.get(m.category) ?? { category: m.category, debtCents: 0, paymentCents: 0, balanceCents: 0 };
    if (m.direction === "debt") row.debtCents += m.amountCents;
    else row.paymentCents += m.amountCents;
    row.balanceCents = row.debtCents - row.paymentCents;
    catMap.set(m.category, row);
  }

  return {
    movements,
    monthly,
    byCategory: [...catMap.values()],
    totals: {
      debtCents: debtTotal,
      paymentCents: paymentTotal,
      balanceTodayCents: balanceToday,
      balanceEndCents: balance,
    },
  };
}
