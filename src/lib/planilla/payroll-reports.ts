/**
 * Cálculos puros de los reportes de Planilla: Resumen Anual, Auditoría
 * y "Próximas obligaciones". Portado de las funciones
 * `getAnnualSummary` / `getAuditoriaData` / `getUpcomingObligations` /
 * `getLedgerBalance` de Atlas `src/services/payroll.ts`, extraídas a
 * `lib/` porque no tocan la base de datos: reciben los arrays ya
 * cargados (entries, ledger) y devuelven las estructuras que pintan las
 * pantallas. El servicio Supabase hace los queries y llama a esto.
 */
import type {
  AuditoriaConceptGroup,
  AuditoriaData,
  AuditoriaEmployeeRow,
  AuditoriaLineItem,
  AuditFinding,
  PayrollEmployee,
  PayrollEmployeeAnnualSummary,
  PayrollEntry,
  UpcomingObligations,
} from "@/types/planilla";
import { periodKey, periodOrdinal, type Period } from "@/lib/planilla/payroll-period";
import {
  buildEmployeeContext,
  computeAnnualDetail,
  computeDecimoAccrualCore,
  computeVacationAccrualCore,
  periodFromDateString,
  PERIODS_IN_YEAR,
  type EmployeeAccrualContext,
  type LedgerRowLite,
  type PeriodTotalLookup,
} from "@/lib/planilla/payroll-accruals";

/** Fila cruda de ledger que necesitan estos reportes (más campos que
 *  `LedgerRowLite`). El servicio la arma mapeando de snake_case. */
export interface LedgerRowFull {
  category: string;
  direction: "debt" | "payment";
  amountCents: number;
  entryDate: string;
  payrollEntryId: string | null;
}

/** Todo el historial de un empleado, ya cargado — lo que el servicio
 *  pasa a cada función de reporte. */
export interface EmployeeHistory {
  employee: PayrollEmployee;
  entries: PayrollEntry[];
  ledger: LedgerRowFull[];
}

function toLite(rows: LedgerRowFull[]): LedgerRowLite[] {
  return rows
    .filter((r) => r.category !== "seguro_social")
    .map((r) => ({ direction: r.direction, amountCents: r.amountCents, payrollEntryId: r.payrollEntryId }));
}

// ============================================================================
// Resumen Anual
// ============================================================================

/** Una fila del pivot de Resumen Anual para un empleado. Portado del
 *  loop interno de `getAnnualSummary` de Atlas. */
export function computeAnnualSummary(
  history: EmployeeHistory,
  year: number
): PayrollEmployeeAnnualSummary {
  const ctx = buildEmployeeContext(history.entries, toLite(history.ledger));
  const lookup = ctx.lookup;

  const totalsByPeriod: Record<string, number> = {};
  let totalPaidCents = 0;
  let salarioCents = 0;
  let decimoCents = 0;
  let vacacionCents = 0;
  let primaCents = 0;
  let descuentosCents = 0;
  let prestamosCents = 0;
  let paidCents = 0;

  const monthHasActivity = new Array(12).fill(false) as boolean[];
  const monthFullyPaid = new Array(12).fill(true) as boolean[];
  const monthHasEntry = new Array(12).fill(false) as boolean[];

  for (const { month, half } of PERIODS_IN_YEAR) {
    const total = lookup({ year, month, half });
    totalsByPeriod[periodKey(month, half)] = total.totalCents;
    totalPaidCents += total.totalCents;
    prestamosCents += total.ledgerDebtCents;
    if (total.entry) {
      const e = total.entry;
      salarioCents +=
        e.basePayCents + e.extraHoursCents + e.extraDaysCents + e.viaticosCents + e.bonusCents + e.diasLibresCents;
      decimoCents += e.decimoPaidCents;
      vacacionCents += e.vacationPaidCents;
      primaCents += e.primaAntiguedadPaidCents;
      descuentosCents += e.horasDescontadasCents + e.diasDescontadosCents + e.otherDeductionCents;
      monthHasActivity[month - 1] = true;
      monthHasEntry[month - 1] = true;
      if (e.paid) paidCents += total.totalCents;
      else monthFullyPaid[month - 1] = false;
    }
  }

  let monthsWithActivity = 0;
  let monthsPaid = 0;
  for (let i = 0; i < 12; i++) {
    if (monthHasActivity[i]) monthsWithActivity++;
    if (monthHasEntry[i] && monthFullyPaid[i]) monthsPaid++;
  }

  return {
    employee: history.employee,
    totalsByPeriod,
    totalPaidCents,
    conceptTotals: { salarioCents, decimoCents, vacacionCents, primaCents, descuentosCents, prestamosCents },
    monthsWithActivity,
    paidCents,
    monthsPaid,
  };
}

// ============================================================================
// Saldo de ledger + próximas obligaciones
// ============================================================================

/** Saldo que el empleado debe: sum(debt) - sum(payment realizado). Un
 *  'payment' cuenta como realizado si no está atado a una quincena, o
 *  si su quincena ya fue pagada. Portado de `getLedgerBalance` de Atlas. */
export function computeLedgerBalance(ledger: LedgerRowFull[], entryPaidById: Map<string, boolean>): number {
  return ledger.reduce((sum, r) => {
    if (r.direction === "debt") return sum + r.amountCents;
    const realized = r.payrollEntryId === null || entryPaidById.get(r.payrollEntryId) === true;
    return realized ? sum - r.amountCents : sum;
  }, 0);
}

/** Saldo de préstamos A LA FECHA: deuda otorgada menos lo ya descontado,
 *  contando todo movimiento cuya quincena ya empezó (por su fecha) — igual
 *  que Auditoría y el estado de cuenta. A diferencia de
 *  `computeLedgerBalance`, NO depende de que la quincena esté marcada
 *  "Pagado": sirve para ver cuánto se debe hoy sin que importe si alguien
 *  ya tildó la casilla. `seguro_social` queda fuera (informativo). */
export function computeLedgerBalanceToDate(ledger: LedgerRowFull[], now: Period): number {
  const nowOrd = periodOrdinal(now.year, now.month, now.half);
  return ledger.reduce((sum, r) => {
    if (r.category === "seguro_social") return sum;
    const p = periodFromDateString(r.entryDate);
    if (!p || periodOrdinal(p.year, p.month, p.half) > nowOrd) return sum;
    return r.direction === "debt" ? sum + r.amountCents : sum - r.amountCents;
  }, 0);
}

/** Un mes de la gráfica "Planilla por mes": de qué está hecha la planilla. */
export interface MonthComposition {
  month: number;
  /** Sueldo base devengado. */
  salaryCents: number;
  /** Horas extra, días extra, viáticos, bonos y días libres. */
  extrasCents: number;
  /** Horas / días descontados y otros descuentos. */
  deductionsCents: number;
  /** Cuotas de préstamos descontadas en planilla. */
  loanPaymentsCents: number;
  /** Préstamos / adelantos otorgados ese mes. */
  loanGivenCents: number;
  /** Neto pagado (el mismo total que Registro). */
  netCents: number;
}

export function computeMonthlyComposition(histories: EmployeeHistory[], year: number): MonthComposition[] {
  const months: MonthComposition[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    salaryCents: 0,
    extrasCents: 0,
    deductionsCents: 0,
    loanPaymentsCents: 0,
    loanGivenCents: 0,
    netCents: 0,
  }));
  for (const h of histories) {
    const lookup = buildEmployeeContext(h.entries, toLite(h.ledger)).lookup;
    for (const { month, half } of PERIODS_IN_YEAR) {
      const total = lookup({ year, month, half });
      const m = months[month - 1];
      m.netCents += total.totalCents;
      m.loanPaymentsCents += total.ledgerPaymentCents;
      m.loanGivenCents += total.ledgerDebtCents;
      const e = total.entry;
      if (e) {
        m.salaryCents += e.basePayCents;
        m.extrasCents += e.extraHoursCents + e.extraDaysCents + e.viaticosCents + e.bonusCents + e.diasLibresCents;
        m.deductionsCents += e.horasDescontadasCents + e.diasDescontadosCents + e.otherDeductionCents;
      }
    }
  }
  return months;
}

/** Próximas obligaciones del negocio: décimo + vacación acumulados y sin
 *  pagar, más saldo de préstamos, sumados sobre los empleados activos.
 *  Portado de `getUpcomingObligations` de Atlas. */
export function computeUpcomingObligations(
  histories: EmployeeHistory[],
  asOf: Period,
  decimoDueDate: string
): UpcomingObligations {
  let decimoPendingCents = 0;
  let vacacionPendingCents = 0;
  let prestamosPendingCents = 0;
  let employeesWithLoanBalance = 0;

  for (const h of histories) {
    if (h.employee.status !== "ACTIVE") continue;
    const ctx = buildEmployeeContext(h.entries, toLite(h.ledger));
    const benefitsBase = h.employee.benefitsBaseSalaryCents ?? undefined;
    decimoPendingCents += computeDecimoAccrualCore(ctx.lookup, asOf, benefitsBase);
    vacacionPendingCents += computeVacationAccrualCore(
      ctx.periodsWithEntries,
      ctx.lastVacationPayout(asOf),
      ctx.lookup,
      asOf,
      benefitsBase
    );
    const entryPaidById = new Map(h.entries.map((e) => [e.id, e.paid]));
    const balance = computeLedgerBalance(h.ledger, entryPaidById);
    if (balance > 0) {
      prestamosPendingCents += balance;
      employeesWithLoanBalance += 1;
    }
  }

  return {
    decimoPendingCents,
    decimoDueDate,
    vacacionPendingCents,
    prestamosPendingCents,
    employeesWithLoanBalance,
  };
}

// ============================================================================
// Auditoría
// ============================================================================

function sumAll(periods: number[]): number {
  return periods.reduce((s, v) => s + v, 0);
}

function makeLineItem(
  key: string,
  labelKey: string,
  periods: number[],
  opts?: { previewPeriods?: number[]; excludeFromSubtotal?: boolean }
): AuditoriaLineItem {
  return {
    key,
    labelKey,
    periods,
    totalCents: sumAll(periods),
    previewPeriods: opts?.previewPeriods,
    excludeFromSubtotal: opts?.excludeFromSubtotal,
  };
}

function makeGroup(key: string, labelKey: string, lineItems: AuditoriaLineItem[]): AuditoriaConceptGroup {
  const counted = lineItems.filter((li) => !li.excludeFromSubtotal);
  const periods = Array.from({ length: 24 }, (_, i) => counted.reduce((s, li) => s + li.periods[i], 0));
  return { key, labelKey, periods, totalCents: sumAll(periods), lineItems };
}

/** Mapa entry.id -> Período (de los entries ya cargados). */
function buildEntryPeriodMap(entries: PayrollEntry[]): Map<string, Period> {
  const map = new Map<string, Period>();
  for (const e of entries) {
    map.set(e.id, { year: e.periodYear, month: e.periodMonth, half: e.periodHalf });
  }
  return map;
}

/** Montos por quincena (24) de una categoría de ledger (y opcionalmente
 *  una dirección) para un empleado/año. Resuelve la quincena vía el
 *  entry vinculado, o parseando `entryDate`. Portado de
 *  `ledgerAmountsByQuincena` de Atlas. */
function ledgerAmountsByQuincena(
  ledger: LedgerRowFull[],
  year: number,
  entryPeriod: Map<string, Period>,
  category: string,
  direction?: "debt" | "payment"
): number[] {
  const periods = new Array(24).fill(0) as number[];
  for (const row of ledger) {
    if (row.category !== category) continue;
    if (direction && row.direction !== direction) continue;
    const resolved =
      (row.payrollEntryId ? entryPeriod.get(row.payrollEntryId) : undefined) ?? periodFromDateString(row.entryDate);
    if (!resolved || resolved.year !== year) continue;
    const idx = (resolved.month - 1) * 2 + (resolved.half - 1);
    periods[idx] += row.amountCents;
  }
  return periods;
}

const LEDGER_GROUPS: { key: string; labelKey: string; descLabelKey: string; category: string; debtOnly?: boolean }[] = [
  { key: "prestamo", labelKey: "li_prestamos", descLabelKey: "li_desc_prestamos", category: "prestamo" },
  { key: "adelanto", labelKey: "li_adelantos", descLabelKey: "li_desc_adelantos", category: "adelanto" },
  { key: "herramienta", labelKey: "li_herramientas", descLabelKey: "li_desc_herramientas", category: "herramienta" },
  { key: "dano", labelKey: "li_danos", descLabelKey: "li_desc_danos", category: "dano" },
  { key: "indrive", labelKey: "li_indrive", descLabelKey: "li_desc_indrive", category: "indrive" },
  { key: "otro", labelKey: "li_otros", descLabelKey: "li_otros_descuentos", category: "otro" },
  // Los intereses de un préstamo se cobran dentro de sus cuotas (categoría del
  // préstamo): solo tienen línea de "otorgado", no de descuento propio.
  { key: "interes", labelKey: "li_interes", descLabelKey: "li_desc_interes", category: "interes", debtOnly: true },
];

/** Una fila de Auditoría (6 grupos de concepto a granularidad de 24
 *  quincenas) + los hallazgos de ese empleado. Portado del loop interno
 *  de `getAuditoriaData` de Atlas. */
export function computeAuditoriaRow(
  history: EmployeeHistory,
  year: number,
  asOfOrdinal: number
): { row: AuditoriaEmployeeRow; findings: AuditFinding[] } {
  const { employee } = history;
  const ctx: EmployeeAccrualContext = buildEmployeeContext(history.entries, toLite(history.ledger));
  const detail = computeAnnualDetail(employee, ctx, year);
  const pick = (fn: (r: (typeof detail)[number]) => number) => detail.map(fn);
  const entryPeriod = buildEntryPeriodMap(history.entries);

  const basePeriods = pick((r) => r.entry?.basePayCents ?? 0);

  const salarios = makeGroup("salarios", "grp_salarios", [
    makeLineItem("base", "li_quincena_base", basePeriods),
    makeLineItem("dias_libres", "li_dias_libres", pick((r) => r.entry?.diasLibresCents ?? 0)),
  ]);

  const prestaciones = makeGroup("prestaciones", "grp_prestaciones", [
    makeLineItem("decimo", "li_decimo", pick((r) => r.entry?.decimoPaidCents ?? 0), {
      previewPeriods: pick((r) => r.decimoAccrualBenefitsCents ?? r.decimoAccrualCents),
    }),
    makeLineItem("vacacion", "li_vacacion", pick((r) => r.entry?.vacationPaidCents ?? 0), {
      previewPeriods: pick((r) => r.vacationAccrualBenefitsCents ?? r.vacationAccrualCents),
    }),
    makeLineItem("prima", "li_prima", pick((r) => r.entry?.primaAntiguedadPaidCents ?? 0), {
      previewPeriods: pick((r) => r.primaAntiguedadAccrualCents),
    }),
    makeLineItem(
      "seguro_social",
      "li_seguro_social",
      ledgerAmountsByQuincena(history.ledger, year, entryPeriod, "seguro_social"),
      { excludeFromSubtotal: true }
    ),
  ]);

  const bonificaciones = makeGroup("bonificaciones", "grp_bonificaciones", [
    makeLineItem("horas_extra", "li_horas_extra", pick((r) => r.entry?.extraHoursCents ?? 0)),
    makeLineItem("dias_extra", "li_dias_extra", pick((r) => r.entry?.extraDaysCents ?? 0)),
    makeLineItem("viaticos", "li_viaticos", pick((r) => r.entry?.viaticosCents ?? 0)),
    makeLineItem("bonos", "li_bonos", pick((r) => r.entry?.bonusCents ?? 0)),
  ]);

  const descuentos = makeGroup("descuentos", "grp_descuentos", [
    makeLineItem("horas_descontadas", "li_horas_descontadas", pick((r) => -(r.entry?.horasDescontadasCents ?? 0))),
    makeLineItem("dias_descontados", "li_dias_descontados", pick((r) => -(r.entry?.diasDescontadosCents ?? 0))),
  ]);

  const prestamosOtros = makeGroup(
    "prestamos_otros",
    "grp_prestamos_otros",
    LEDGER_GROUPS.map((g) =>
      makeLineItem(g.key, g.labelKey, ledgerAmountsByQuincena(history.ledger, year, entryPeriod, g.category, "debt"))
    )
  );

  const descuentoPrestamos = makeGroup(
    "descuento_prestamos",
    "grp_descuento_prestamos",
    LEDGER_GROUPS.filter((g) => !g.debtOnly).map((g) =>
      makeLineItem(
        `descuento_${g.key}`,
        g.descLabelKey,
        ledgerAmountsByQuincena(history.ledger, year, entryPeriod, g.category, "payment").map((v) => -v)
      )
    )
  );

  const groups = [salarios, prestaciones, bonificaciones, descuentos, prestamosOtros, descuentoPrestamos];
  const periods = detail.map((r) => r.totalCents);
  const totalCents = sumAll(periods);

  // Hallazgos: anomalías reales, baratas de verificar.
  const findings: AuditFinding[] = [];
  let sawEntry = false;
  let lastEntryOrd = -1;
  let lastEntryMonth = -1;
  for (const r of detail) {
    if (r.entry?.paid && r.totalCents <= 0) {
      findings.push({
        employeeId: employee.id,
        employeeName: employee.name,
        severity: "warning",
        kind: "paid_zero",
        year,
        month: r.month,
        half: r.half,
        totalCents: r.totalCents,
      });
    }
    if (r.totalCents < 0) {
      findings.push({
        employeeId: employee.id,
        employeeName: employee.name,
        severity: "error",
        kind: "negative",
        year,
        month: r.month,
        half: r.half,
        totalCents: r.totalCents,
      });
    }
    const ord = periodOrdinal(r.year, r.month, r.half);
    if (r.entry) {
      if (!employee.endDate && sawEntry && lastEntryOrd < ord - 1 && ord <= asOfOrdinal) {
        findings.push({
          employeeId: employee.id,
          employeeName: employee.name,
          severity: "warning",
          kind: "gap",
          year,
          monthA: lastEntryMonth,
          monthB: r.month,
        });
      }
      sawEntry = true;
      lastEntryOrd = ord;
      lastEntryMonth = r.month;
    }
  }

  return { row: { employee, periods, totalCents, basePeriods, groups }, findings };
}

/** Ensambla la data completa de Auditoría a partir del historial de
 *  cada empleado. */
export function computeAuditoriaData(
  histories: EmployeeHistory[],
  year: number,
  asOfOrdinal: number
): AuditoriaData {
  const rows: AuditoriaEmployeeRow[] = [];
  const findings: AuditFinding[] = [];
  for (const h of histories) {
    const { row, findings: rowFindings } = computeAuditoriaRow(h, year, asOfOrdinal);
    rows.push(row);
    findings.push(...rowFindings);
  }
  const periodTotals = Array.from({ length: 24 }, (_, i) => rows.reduce((s, r) => s + r.periods[i], 0));
  const grandTotalCents = sumAll(periodTotals);
  return { rows, periodTotals, grandTotalCents, findings };
}

// re-export para el servicio
export type { PeriodTotalLookup };
