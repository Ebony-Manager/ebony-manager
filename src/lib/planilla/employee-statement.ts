import type { AnnualDetailRow } from "./payroll-accruals";
import type { Period } from "./payroll-period";
import { isMonthOccurred, isPeriodOccurred } from "./payroll-projection";

/**
 * Estado de cuenta de UN empleado para un año: por mes (lo normal) o por
 * quincena. Cada fila junta lo que se le paga (salario, bonificaciones),
 * lo que se le descuenta, lo que se le prestó y lo que se le descontó de
 * esos préstamos, el neto pagado y el saldo de préstamos al cierre.
 * Puro, para poder probarlo.
 *
 * `netCents` es el total que ya calcula la app (`totalCents`), no una
 * suma de las otras columnas: así el neto nunca se desfasa de Registro.
 */
export type StatementGranularity = "month" | "quincena";

export interface StatementRow {
  key: string;
  year: number;
  month: number;
  /** Solo en vista por quincena. */
  half: 1 | 2 | null;
  salaryCents: number;
  bonusCents: number;
  deductionCents: number;
  loanGivenCents: number;
  loanPaidCents: number;
  netCents: number;
  /** Saldo de préstamos al cierre del período. */
  loanBalanceCents: number;
  /** El período ya empezó (si no, es proyección y se muestra en gris). */
  occurred: boolean;
}

function fromDetail(r: AnnualDetailRow): Omit<StatementRow, "key" | "half" | "occurred"> {
  const e = r.entry;
  return {
    year: r.year,
    month: r.month,
    salaryCents: e?.basePayCents ?? 0,
    bonusCents: e ? e.extraHoursCents + e.extraDaysCents + e.viaticosCents + e.bonusCents + e.diasLibresCents : 0,
    // Asistencia aparte; "otros descuentos" va con préstamos y descuentos (como en Quincena).
    deductionCents: e ? e.horasDescontadasCents + e.diasDescontadosCents : 0,
    loanGivenCents: r.ledgerDebtCents,
    loanPaidCents: r.ledgerPaymentCents + (e?.otherDeductionCents ?? 0),
    netCents: r.totalCents,
    loanBalanceCents: r.runningLedgerBalanceCents,
  };
}

export function buildEmployeeStatement(
  rows: readonly AnnualDetailRow[],
  granularity: StatementGranularity,
  now: Period
): StatementRow[] {
  const withData = rows.filter((r) => r.entry !== null || r.ledgerDebtCents > 0 || r.ledgerPaymentCents > 0);
  // Una quincena cuenta (en totales y saldo) solo cuando se cerró y se marcó
  // pagada; sin planilla (ej. solo un adelanto otorgado), desde que empezó.
  const counted = (r: AnnualDetailRow) => (r.entry ? r.entry.paid : isPeriodOccurred(r.year, r.month, r.half, now));

  if (granularity === "quincena") {
    return withData.map((r) => ({
      ...fromDetail(r),
      key: `${r.year}-${r.month}-${r.half}`,
      half: r.half,
      occurred: counted(r),
    }));
  }

  // Por mes: las quincenas pagadas se suman en la fila del mes; una que todavía
  // no se paga va aparte (en gris), para no mezclar lo pagado con lo pendiente.
  const out: StatementRow[] = [];
  for (const r of withData) {
    const d = fromDetail(r);
    if (!counted(r)) {
      out.push({ ...d, key: `${r.year}-${r.month}-${r.half}`, half: r.half, occurred: false });
      continue;
    }
    let row = out[out.length - 1];
    if (!row || row.year !== r.year || row.month !== r.month || row.half !== null) {
      row = { ...d, key: `${r.year}-${r.month}`, half: null, occurred: isMonthOccurred(r.year, r.month, now) };
      out.push(row);
      continue;
    }
    row.salaryCents += d.salaryCents;
    row.bonusCents += d.bonusCents;
    row.deductionCents += d.deductionCents;
    row.loanGivenCents += d.loanGivenCents;
    row.loanPaidCents += d.loanPaidCents;
    row.netCents += d.netCents;
    row.loanBalanceCents = d.loanBalanceCents;
  }
  return out;
}

/** Totales de las filas que ya ocurrieron (o de todas con `onlyOccurred`
 *  en false). */
export function statementTotals(rows: readonly StatementRow[], onlyOccurred = true) {
  const used = onlyOccurred ? rows.filter((r) => r.occurred) : rows;
  return used.reduce(
    (t, r) => ({
      salaryCents: t.salaryCents + r.salaryCents,
      bonusCents: t.bonusCents + r.bonusCents,
      deductionCents: t.deductionCents + r.deductionCents,
      loanGivenCents: t.loanGivenCents + r.loanGivenCents,
      loanPaidCents: t.loanPaidCents + r.loanPaidCents,
      netCents: t.netCents + r.netCents,
    }),
    { salaryCents: 0, bonusCents: 0, deductionCents: 0, loanGivenCents: 0, loanPaidCents: 0, netCents: 0 }
  );
}
