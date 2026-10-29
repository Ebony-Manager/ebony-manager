import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttendanceEmployee, AttendancePeriodRow } from "@/lib/planilla/attendance-summary";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { Database } from "@/types/database";
import type {
  AuditoriaData,
  LedgerCategory,
  LedgerDirection,
  LoanOverviewRow,
  LoanCategory,
  LoanPaymentMethod,
  PayrollEmployee,
  PayrollEmployeeAnnualSummary,
  PayrollEntry,
  PayrollLedgerEntry,
  PayrollLoan,
  PayrollLoanInstallment,
  PayrollLoanWithSchedule,
  PayrollPeriodTotal,
  PaymentMethod,
  UpcomingObligations,
} from "@/types/planilla";
import {
  buildEmployeeContext,
  computeAnnualDetail,
  computePeriodTotalFromEntry,
  type AnnualDetailRow,
} from "@/lib/planilla/payroll-accruals";
import {
  computeAnnualSummary,
  computeAuditoriaData,
  computeLedgerBalance,
  computeLedgerBalanceToDate,
  computeMonthlyComposition,
  computeUpcomingObligations,
  type EmployeeHistory,
  type LedgerRowFull,
} from "@/lib/planilla/payroll-reports";
import {
  computeLoanInterestCents,
  computeLoanSchedule,
  defaultLoanStartPeriod,
  isSingleInstallment,
  reflowLoanSchedule,
  type LoanInterestInput,
  type ReflowMode,
  type PendingInstallment,
} from "@/lib/planilla/payroll-loans";
import { periodOrdinal, currentPeriod, type Period } from "@/lib/planilla/payroll-period";
import {
  earliestSalary,
  monthlySalaryAt,
  quincenaBaseCentsAt,
  type SalaryChange,
} from "@/lib/planilla/salary-history";
import { getPayrollEmployee, getPayrollEmployees } from "@/services/payroll-employees";
import { getAllSalaryChanges, getSalaryChanges, toSalaryChanges } from "@/services/payroll-salary";

/** ¿Hay historial de sueldo vigente para esta quincena? Sí si la
 *  quincena es igual o posterior a la primera fila del historial (que
 *  se crea con el ingreso del empleado). Antes de eso: sin sueldo. */
function hasSalaryFor(changes: SalaryChange[], year: number, month: number, half: 1 | 2): boolean {
  const first = earliestSalary(changes);
  if (!first) return false;
  return (
    periodOrdinal(year, month, half) >=
    periodOrdinal(first.effectiveYear, first.effectiveMonth, first.effectiveHalf)
  );
}

/** Entry sintética (no persistida, `id: ""`) que solo lleva la quincena
 *  base derivada del historial — para que la rejilla y los KPIs de
 *  Registro la reflejen antes de que exista una fila real. */
function seededEntry(
  employeeId: string,
  year: number,
  month: number,
  half: 1 | 2,
  baseCents: number
): PayrollEntry {
  return {
    id: "",
    employeeId,
    periodYear: year,
    periodMonth: month,
    periodHalf: half,
    basePayCents: baseCents,
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
  };
}

/**
 * Capa de datos de Planilla — portada de Atlas `src/services/payroll.ts`,
 * de SQLite síncrono a Supabase async. Las fórmulas (total de quincena,
 * acumulados de Décimo/Vacación/Prima, cuotas de préstamo) NO se
 * reimplementan acá: se importan puras de `src/lib/planilla/`. Este
 * archivo solo hace los queries y arma la forma que consumen las
 * pantallas. Sin `propertyId` (Ebony es una sola empresa).
 *
 * Cubre: Registro (+ quincena base por defecto que se congela al primer
 * guardado), Resumen Anual, Auditoría, obligaciones, Detalle de
 * empleado, ledger genérico y préstamos/adelantos con su calendario de
 * cuotas auto-aplicado.
 */

type EntryRow = Database["public"]["Tables"]["payroll_entries"]["Row"];

/** `numeric` de Postgres puede volver como string por PostgREST — se
 *  normaliza a number al mapear. */
function num(v: number | string | null): number {
  return typeof v === "string" ? Number(v) : (v ?? 0);
}

function mapEntry(r: EntryRow): PayrollEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    periodYear: r.period_year,
    periodMonth: r.period_month,
    periodHalf: r.period_half === 2 ? 2 : 1,
    basePayCents: r.base_pay_cents,
    extraHours: num(r.extra_hours),
    extraHoursCents: r.extra_hours_cents,
    extraDays: num(r.extra_days),
    extraDaysCents: r.extra_days_cents,
    viaticosCents: r.viaticos_cents,
    bonusCents: r.bonus_cents,
    diasLibresCents: r.dias_libres_cents,
    horasDescontadas: num(r.horas_descontadas),
    horasDescontadasCents: r.horas_descontadas_cents,
    diasDescontados: num(r.dias_descontados),
    diasDescontadosCents: r.dias_descontados_cents,
    otherDeductionCents: r.other_deduction_cents,
    decimoPaidCents: r.decimo_paid_cents,
    vacationPaidCents: r.vacation_paid_cents,
    primaAntiguedadPaidCents: r.prima_antiguedad_paid_cents,
    paymentMethod: (r.payment_method as PaymentMethod) ?? "transferencia",
    paid: r.paid,
    paidAt: r.paid_at,
    notes: r.notes,
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getEntryRow(
  supabase: SupabaseServerClient,
  employeeId: string,
  year: number,
  month: number,
  half: 1 | 2
): Promise<EntryRow | null> {
  const { data, error } = await supabase
    .from("payroll_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("period_half", half)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getEntry(
  employeeId: string,
  year: number,
  month: number,
  half: 1 | 2
): Promise<PayrollEntry | null> {
  const supabase = await createClient();
  const row = await getEntryRow(supabase, employeeId, year, month, half);
  return row ? mapEntry(row) : null;
}

export interface UpsertEntryInput {
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  periodHalf: 1 | 2;
  // Sin basePayCents: la base la fija el historial de sueldos, no un
  // formulario. `upsertEntry` la deriva y la escribe siempre.
  extraHours?: number;
  extraHoursCents?: number;
  extraDays?: number;
  extraDaysCents?: number;
  viaticosCents?: number;
  bonusCents?: number;
  diasLibresCents?: number;
  horasDescontadas?: number;
  horasDescontadasCents?: number;
  diasDescontados?: number;
  diasDescontadosCents?: number;
  otherDeductionCents?: number;
  decimoPaidCents?: number;
  vacationPaidCents?: number;
  primaAntiguedadPaidCents?: number;
  paymentMethod?: PaymentMethod;
  paid?: boolean;
  notes?: string | null;
}

/** Crea-o-actualiza la fila de este empleado+quincena, mezclando los
 *  campos provistos sobre lo que ya haya. `base_pay_cents` SIEMPRE se
 *  deriva del historial de sueldos para esa quincena (no del input): la
 *  base ya no se congela ni se edita a mano. `paid_at` se sella al
 *  guardar con `paid`. */
export async function upsertEntry(input: UpsertEntryInput): Promise<PayrollEntry> {
  const supabase = await createClient();
  // La fila actual y el historial de sueldos son independientes: en paralelo.
  const [existing, salaryRows] = await Promise.all([
    getEntryRow(supabase, input.employeeId, input.periodYear, input.periodMonth, input.periodHalf),
    getSalaryChanges(input.employeeId),
  ]);
  const cur = existing ? mapEntry(existing) : null;

  const salaryChanges = toSalaryChanges(salaryRows);
  const basePayCents = quincenaBaseCentsAt(
    salaryChanges,
    input.periodYear,
    input.periodMonth,
    input.periodHalf
  );

  const merged = {
    base_pay_cents: basePayCents,
    extra_hours: input.extraHours ?? cur?.extraHours ?? 0,
    extra_hours_cents: input.extraHoursCents ?? cur?.extraHoursCents ?? 0,
    extra_days: input.extraDays ?? cur?.extraDays ?? 0,
    extra_days_cents: input.extraDaysCents ?? cur?.extraDaysCents ?? 0,
    viaticos_cents: input.viaticosCents ?? cur?.viaticosCents ?? 0,
    bonus_cents: input.bonusCents ?? cur?.bonusCents ?? 0,
    dias_libres_cents: input.diasLibresCents ?? cur?.diasLibresCents ?? 0,
    horas_descontadas: input.horasDescontadas ?? cur?.horasDescontadas ?? 0,
    horas_descontadas_cents: input.horasDescontadasCents ?? cur?.horasDescontadasCents ?? 0,
    dias_descontados: input.diasDescontados ?? cur?.diasDescontados ?? 0,
    dias_descontados_cents: input.diasDescontadosCents ?? cur?.diasDescontadosCents ?? 0,
    other_deduction_cents: input.otherDeductionCents ?? cur?.otherDeductionCents ?? 0,
    decimo_paid_cents: input.decimoPaidCents ?? cur?.decimoPaidCents ?? 0,
    vacation_paid_cents: input.vacationPaidCents ?? cur?.vacationPaidCents ?? 0,
    prima_antiguedad_paid_cents: input.primaAntiguedadPaidCents ?? cur?.primaAntiguedadPaidCents ?? 0,
    payment_method: input.paymentMethod ?? cur?.paymentMethod ?? "transferencia",
    paid: input.paid ?? cur?.paid ?? false,
    notes: input.notes === undefined ? (cur?.notes ?? null) : input.notes,
  };
  const paid_at = merged.paid ? new Date().toISOString() : null;

  if (existing) {
    const { data, error } = await supabase
      .from("payroll_entries")
      .update({ ...merged, paid_at })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapEntry(data);
  }

  const { data, error } = await supabase
    .from("payroll_entries")
    .insert({
      employee_id: input.employeeId,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      period_half: input.periodHalf,
      ...merged,
      paid_at,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEntry(data);
}

/** Todo lo que se debe/abona contra una quincena — se excluye
 *  `seguro_social` (informativo), igual que Atlas. */
async function ledgerForEntryIds(
  supabase: SupabaseServerClient,
  entryIds: string[]
): Promise<Map<string, { debt: number; payment: number; payments: QuincenaDeduction[] }>> {
  const byEntry = new Map<string, { debt: number; payment: number; payments: QuincenaDeduction[] }>();
  if (entryIds.length === 0) return byEntry;
  const { data, error } = await supabase
    .from("payroll_ledger_entries")
    .select("direction, amount_cents, payroll_entry_id, category, notes")
    .in("payroll_entry_id", entryIds)
    .neq("category", "seguro_social");
  if (error) throw new Error(error.message);
  for (const l of data ?? []) {
    if (!l.payroll_entry_id) continue;
    const acc = byEntry.get(l.payroll_entry_id) ?? { debt: 0, payment: 0, payments: [] };
    if (l.direction === "payment") {
      acc.payment += l.amount_cents;
      acc.payments.push({ category: l.category as LedgerCategory, amountCents: l.amount_cents, notes: l.notes });
    } else acc.debt += l.amount_cents;
    byEntry.set(l.payroll_entry_id, acc);
  }
  return byEntry;
}

export async function getPeriodTotal(
  employeeId: string,
  year: number,
  month: number,
  half: 1 | 2
): Promise<PayrollPeriodTotal> {
  const supabase = await createClient();
  const row = await getEntryRow(supabase, employeeId, year, month, half);
  const changes = toSalaryChanges(await getSalaryChanges(employeeId));
  const baseCents = quincenaBaseCentsAt(changes, year, month, half);
  // La base la manda el historial de sueldos, no lo que quedó guardado
  // en la fila.
  const entry = row ? { ...mapEntry(row), basePayCents: baseCents } : null;
  const ledger = row ? (await ledgerForEntryIds(supabase, [row.id])).get(row.id) ?? { debt: 0, payment: 0 } : { debt: 0, payment: 0 };
  return computePeriodTotalFromEntry(entry, ledger);
}

/** Una cuota que se descuenta en la quincena (préstamo, adelanto, herramienta…). */
export interface QuincenaDeduction {
  category: LedgerCategory;
  amountCents: number;
  /** "Cuota 1 de 3", la nota del registro, etc. */
  notes: string | null;
}

export interface RegistroRow {
  employee: PayrollEmployee;
  total: PayrollPeriodTotal;
  /** Detalle de `total.ledgerPaymentCents`: las cuotas de esta quincena. */
  deductions: QuincenaDeduction[];
  /** Sueldo mensual vigente en esa quincena (según el historial): el cliente lo
   *  usa para calcular al instante el monto de horas/días extra y descontados. */
  monthlySalaryCents: number;
}

/** Fuente de datos de la rejilla de Registro: una fila por empleado
 *  activo, con el total computado de esa quincena. La "Quincena Base" de
 *  cada fila se deriva del historial de sueldos (nunca de lo guardado ni
 *  de un input). Batchea todo el período (entries + ledger + sueldos). */
export async function getRegistroForPeriod(year: number, month: number, half: 1 | 2): Promise<RegistroRow[]> {
  const supabase = await createClient();
  // Empleados, historial de sueldos y quincenas son independientes: en
  // paralelo (el ledger sí depende de las quincenas y va después).
  const [allEmployees, salaryByEmployee, entriesRes] = await Promise.all([
    getPayrollEmployees(),
    getAllSalaryChanges(),
    supabase
      .from("payroll_entries")
      .select("*")
      .eq("period_year", year)
      .eq("period_month", month)
      .eq("period_half", half),
  ]);
  const employees = allEmployees.filter((e) => e.status === "ACTIVE");
  const { data: entryRows, error } = entriesRes;
  if (error) throw new Error(error.message);

  const entryByEmployee = new Map<string, EntryRow>();
  for (const r of entryRows ?? []) entryByEmployee.set(r.employee_id, r);
  const ledgerByEntry = await ledgerForEntryIds(supabase, (entryRows ?? []).map((r) => r.id));

  return employees.map((employee) => {
    const row = entryByEmployee.get(employee.id) ?? null;
    const ledger = (row && ledgerByEntry.get(row.id)) || { debt: 0, payment: 0, payments: [] };
    const changes = toSalaryChanges(salaryByEmployee.get(employee.id) ?? []);
    const baseCents = quincenaBaseCentsAt(changes, year, month, half);
    // Con fila real: se le sobrescribe la base con la del historial.
    // Sin fila: entry sintética (no persistida) para que Base, "Total
    // quincena" y "Total a Pagar" la reflejen — salvo quincenas
    // anteriores al ingreso del empleado (sin sueldo -> null).
    const entry = row
      ? { ...mapEntry(row), basePayCents: baseCents }
      : hasSalaryFor(changes, year, month, half)
        ? seededEntry(employee.id, year, month, half, baseCents)
        : null;
    return {
      employee,
      total: computePeriodTotalFromEntry(entry, ledger),
      deductions: ledger.payments,
      monthlySalaryCents: monthlySalaryAt(changes, year, month, half),
    };
  });
}

// ============================================================================
// Historial completo por empleado (para reportes)
// ============================================================================

type LedgerRow = Database["public"]["Tables"]["payroll_ledger_entries"]["Row"];
type LoanRow = Database["public"]["Tables"]["payroll_loans"]["Row"];

function mapLedger(r: LedgerRow): PayrollLedgerEntry {
  return {
    id: r.id,
    employeeId: r.employee_id,
    category: (r.category as LedgerCategory) ?? "otro",
    direction: r.direction === "payment" ? "payment" : "debt",
    amountCents: r.amount_cents,
    entryDate: r.entry_date,
    payrollEntryId: r.payroll_entry_id,
    loanId: r.loan_id,
    notes: r.notes,
  };
}

function toLedgerRowFull(r: LedgerRow): LedgerRowFull {
  return {
    category: r.category,
    direction: r.direction === "payment" ? "payment" : "debt",
    amountCents: r.amount_cents,
    entryDate: r.entry_date,
    payrollEntryId: r.payroll_entry_id,
  };
}

/** Normaliza la base de cada quincena al sueldo vigente en esa quincena
 *  según el historial — así todo lo que consume `entry.basePayCents`
 *  (total, acumulados, Auditoría, Resumen, Detalle) refleja los aumentos
 *  sin tocar ninguna fórmula. */
function withHistoricalBase(entries: PayrollEntry[], changes: SalaryChange[]): PayrollEntry[] {
  if (changes.length === 0) return entries;
  return entries.map((e) => ({
    ...e,
    basePayCents: quincenaBaseCentsAt(changes, e.periodYear, e.periodMonth, e.periodHalf),
  }));
}

/** Trae TODO el historial (entries + ledger + sueldos) de todos los
 *  empleados y lo agrupa por empleado — la base de Resumen Anual,
 *  Auditoría y Dashboard. */
async function loadAllHistories(): Promise<EmployeeHistory[]> {
  const supabase = await createClient();
  // Las cuatro lecturas son independientes: en paralelo, en vez de una
  // tras otra (cada una es un viaje de red completo a Supabase).
  const [employees, salaryByEmp, entryRows, ledgerRows] = await Promise.all([
    getPayrollEmployees(),
    getAllSalaryChanges(),
    selectAllRows((from, to) => supabase.from("payroll_entries").select("*").order("id").range(from, to)),
    selectAllRows((from, to) => supabase.from("payroll_ledger_entries").select("*").order("id").range(from, to)),
  ]);

  const entriesByEmp = new Map<string, PayrollEntry[]>();
  for (const r of entryRows ?? []) {
    const list = entriesByEmp.get(r.employee_id) ?? [];
    list.push(mapEntry(r));
    entriesByEmp.set(r.employee_id, list);
  }
  const ledgerByEmp = new Map<string, LedgerRowFull[]>();
  for (const r of ledgerRows ?? []) {
    const list = ledgerByEmp.get(r.employee_id) ?? [];
    list.push(toLedgerRowFull(r));
    ledgerByEmp.set(r.employee_id, list);
  }

  return employees.map((employee) => ({
    employee,
    entries: withHistoricalBase(
      entriesByEmp.get(employee.id) ?? [],
      toSalaryChanges(salaryByEmp.get(employee.id) ?? [])
    ),
    ledger: ledgerByEmp.get(employee.id) ?? [],
  }));
}

/** Historial de un solo empleado (3 queries). */
async function loadHistory(employeeId: string): Promise<EmployeeHistory | null> {
  const supabase = await createClient();
  // Empleado, quincenas, ledger y sueldos son independientes: en paralelo.
  const [employee, entriesRes, ledgerRes, salaryChanges] = await Promise.all([
    getPayrollEmployee(employeeId),
    supabase.from("payroll_entries").select("*").eq("employee_id", employeeId),
    supabase.from("payroll_ledger_entries").select("*").eq("employee_id", employeeId),
    getSalaryChanges(employeeId),
  ]);
  if (!employee) return null;
  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (ledgerRes.error) throw new Error(ledgerRes.error.message);

  const changes = toSalaryChanges(salaryChanges);
  return {
    employee,
    entries: withHistoricalBase((entriesRes.data ?? []).map(mapEntry), changes),
    ledger: (ledgerRes.data ?? []).map(toLedgerRowFull),
  };
}

// ============================================================================
// Reportes
// ============================================================================

/** Fuente del pivot de Resumen Anual: una fila por empleado (activo o
 *  no — el historial nunca se esconde). */
export async function getAnnualSummary(year: number): Promise<PayrollEmployeeAnnualSummary[]> {
  const histories = await loadAllHistories();
  return histories.map((h) => computeAnnualSummary(h, year));
}

/** Lo descontado por asistencia en cada quincena del año, por empleado
 *  (para el Resumen de asistencia: quién falta más, quién llega tarde). */
export async function getAttendanceSummary(year: number): Promise<{ employees: AttendanceEmployee[]; rows: AttendancePeriodRow[] }> {
  const supabase = await createClient();
  const [emps, entries] = await Promise.all([
    getPayrollEmployees(),
    supabase
      .from("payroll_entries")
      .select("employee_id, period_month, period_half, horas_descontadas, dias_descontados, horas_descontadas_cents, dias_descontados_cents")
      .eq("period_year", year),
  ]);
  if (entries.error) throw new Error(entries.error.message);
  return {
    employees: emps.map((e) => ({ id: e.id, name: e.name, categoria: e.categoria, active: e.status === "ACTIVE", sortOrder: e.sortOrder })),
    rows: (entries.data ?? []).map((r) => ({
      employeeId: r.employee_id,
      month: r.period_month,
      half: r.period_half as 1 | 2,
      hours: Number(r.horas_descontadas ?? 0),
      days: Number(r.dias_descontados ?? 0),
      cents: (r.horas_descontadas_cents ?? 0) + (r.dias_descontados_cents ?? 0),
    })),
  };
}

/** Fuente de Auditoría: 24 quincenas × empleado, por concepto, más los
 *  hallazgos automáticos. */
export async function getAuditoriaData(year: number): Promise<AuditoriaData> {
  const histories = await loadAllHistories();
  const asOf = currentPeriod();
  return computeAuditoriaData(histories, year, periodOrdinal(asOf.year, asOf.month, asOf.half));
}

/** Todo lo que pinta el Dashboard, calculado con UNA sola carga del
 *  historial (antes eran 3-4 cargas completas, una por cada dato): resumen
 *  anual por empleado, obligaciones, saldo de préstamos a la fecha por
 *  empleado y la composición mes a mes de la planilla. */
export async function getPlanillaOverview(year: number) {
  const histories = await loadAllHistories();
  const asOf = currentPeriod();
  return {
    rows: histories.map((h) => computeAnnualSummary(h, year)),
    obligations: computeUpcomingObligations(
      histories,
      asOf,
      nextDecimoInstallmentDate(new Date()).toISOString().slice(0, 10)
    ),
    balances: Object.fromEntries(
      histories.map((h) => [h.employee.id, computeLedgerBalanceToDate(h.ledger, asOf)])
    ) as Record<string, number>,
    composition: computeMonthlyComposition(histories, year),
  };
}

/** Las tres obligaciones vivas del negocio (Registro / Dashboard). */
export async function getUpcomingObligations(): Promise<UpcomingObligations> {
  const histories = await loadAllHistories();
  const today = new Date();
  return computeUpcomingObligations(histories, currentPeriod(), nextDecimoInstallmentDate(today).toISOString().slice(0, 10));
}

/** Próxima fecha legal de cuota de Décimo (15-abr, 15-ago, 15-dic). */
function nextDecimoInstallmentDate(today: Date): Date {
  const y = today.getFullYear();
  const candidates = [new Date(y, 3, 15), new Date(y, 7, 15), new Date(y, 11, 15), new Date(y + 1, 3, 15)];
  for (const c of candidates) if (c.getTime() >= today.getTime()) return c;
  return candidates[candidates.length - 1];
}

/** Detalle mes a mes de un empleado para el sheet de Detalle. */
export async function getEmployeeAnnualDetail(
  employeeId: string,
  year: number,
  projectFuture = false
): Promise<AnnualDetailRow[]> {
  const history = await loadHistory(employeeId);
  if (!history) return [];
  const ctx = buildEmployeeContext(
    history.entries,
    history.ledger
      .filter((r) => r.category !== "seguro_social")
      .map((r) => ({ direction: r.direction, amountCents: r.amountCents, payrollEntryId: r.payrollEntryId }))
  );
  return computeAnnualDetail(history.employee, ctx, year, projectFuture);
}

// ============================================================================
// Ledger genérico (herramientas, daños, seguro social, carnet, otros)
// ============================================================================

export async function getLedgerEntries(employeeId: string): Promise<PayrollLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_ledger_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .order("entry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLedger);
}

/** Saldo que el empleado debe ahora mismo. */
export async function getLedgerBalance(employeeId: string): Promise<number> {
  const supabase = await createClient();
  const { data: ledgerRows, error } = await supabase
    .from("payroll_ledger_entries")
    .select("*")
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);

  const { data: entryRows, error: e2 } = await supabase
    .from("payroll_entries")
    .select("id, paid")
    .eq("employee_id", employeeId);
  if (e2) throw new Error(e2.message);
  const entryPaidById = new Map((entryRows ?? []).map((r) => [r.id, r.paid]));

  return computeLedgerBalance((ledgerRows ?? []).map(toLedgerRowFull), entryPaidById);
}

export async function createLedgerEntry(input: {
  employeeId: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  entryDate: string;
  payrollEntryId?: string | null;
  loanId?: string | null;
  notes?: string | null;
}): Promise<PayrollLedgerEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_ledger_entries")
    .insert({
      employee_id: input.employeeId,
      category: input.category,
      direction: input.direction,
      amount_cents: input.amountCents,
      entry_date: input.entryDate,
      payroll_entry_id: input.payrollEntryId ?? null,
      loan_id: input.loanId ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapLedger(data);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Préstamos / adelantos (calendario de cuotas auto-aplicado)
// ============================================================================

function toLoanCategory(c: string): LoanCategory {
  return c === "adelanto" || c === "herramienta" || c === "dano" || c === "indrive" || c === "otro" || c === "tercero" ? c : "prestamo";
}

function mapLoan(r: LoanRow): PayrollLoan {
  return {
    id: r.id,
    employeeId: r.employee_id,
    category: toLoanCategory(r.category),
    principalCents: r.principal_cents,
    // Columnas de la migración 20261016120000: `?? 0` mantiene la app andando sin ella.
    interestCents: r.interest_cents ?? 0,
    interestMode:
      r.interest_mode === "monthly_pct" || r.interest_mode === "total_pct" || r.interest_mode === "fixed"
        ? r.interest_mode
        : null,
    interestRatePct: r.interest_rate_pct === null || r.interest_rate_pct === undefined ? null : Number(r.interest_rate_pct),
    paymentMethod: (r.payment_method as LoanPaymentMethod) ?? "cuota_fija",
    numInstallments: r.num_installments,
    requestDate: r.request_date,
    startPeriod: {
      year: r.start_period_year,
      month: r.start_period_month,
      half: r.start_period_half === 2 ? 2 : 1,
    },
    status: r.status === "cancelled" ? "cancelled" : "active",
    notes: r.notes,
  };
}

function periodApproxDate(p: Period): Date {
  return new Date(p.year, p.month - 1, p.half === 1 ? 15 : 28);
}

/**
 * Registra un préstamo/adelanto Y materializa de una vez todo su
 * calendario: una fila 'debt' por el monto otorgado, más una fila
 * 'payment' por cuota, cada una enganchada (vía payrollEntryId) a la
 * fila real de esa quincena — creada acá si no existe. Portado de
 * `createLoan` de Atlas.
 */
export async function createLoan(input: {
  employeeId: string;
  category: LoanCategory;
  principalCents: number;
  paymentMethod?: LoanPaymentMethod;
  requestDate: string;
  numInstallments: number;
  startPeriod?: Period;
  /** Solo con paymentMethod "cuota_variable": monto de cada cuota (suman principal + intereses). */
  installmentAmountsCents?: number[];
  /** Intereses a cobrar (opcional). El monto se calcula acá, no se confía en el cliente. */
  interest?: LoanInterestInput | null;
  notes?: string | null;
}): Promise<PayrollLoanWithSchedule> {
  const supabase = await createClient();
  const paymentMethod = input.paymentMethod ?? "cuota_fija";
  const numInstallments = isSingleInstallment(input.category) ? 1 : input.numInstallments;
  const startPeriod = input.startPeriod ?? defaultLoanStartPeriod(input.category, input.requestDate);
  if (!startPeriod) throw new Error("Fecha de solicitud inválida");
  const interestCents = computeLoanInterestCents(input.principalCents, numInstallments, input.interest);
  // Las cuotas pagan lo entregado MÁS los intereses.
  const schedule = computeLoanSchedule(
    input.principalCents + interestCents,
    numInstallments,
    startPeriod,
    paymentMethod,
    input.installmentAmountsCents
  );

  const { data: loanRow, error } = await supabase
    .from("payroll_loans")
    .insert({
      employee_id: input.employeeId,
      category: input.category,
      principal_cents: input.principalCents,
      payment_method: paymentMethod,
      num_installments: numInstallments,
      request_date: input.requestDate,
      start_period_year: startPeriod.year,
      start_period_month: startPeriod.month,
      start_period_half: startPeriod.half,
      status: "active",
      notes: input.notes ?? null,
      // Solo viajan si hay intereses, así crear un préstamo sin intereses
      // sigue funcionando aunque la migración 20261016120000 aún no se aplique.
      ...(interestCents > 0 && input.interest
        ? {
            interest_cents: interestCents,
            interest_mode: input.interest.mode,
            interest_rate_pct: input.interest.mode === "fixed" ? null : (input.interest.ratePct ?? null),
          }
        : {}),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const loanId = loanRow.id;

  // El monto otorgado — informativo, nunca atado a una quincena.
  await createLedgerEntry({
    employeeId: input.employeeId,
    category: input.category,
    direction: "debt",
    amountCents: input.principalCents,
    entryDate: input.requestDate,
    loanId,
    notes: input.notes ?? null,
  });

  // Los intereses, como una deuda propia enlazada al préstamo: así el saldo del
  // empleado cuadra con las cuotas y se pueden sumar aparte como ganancia.
  if (interestCents > 0) {
    await createLedgerEntry({
      employeeId: input.employeeId,
      category: "interes",
      direction: "debt",
      amountCents: interestCents,
      entryDate: input.requestDate,
      loanId,
      notes: "Intereses",
    });
  }

  const installments: PayrollLoanInstallment[] = [];
  for (let i = 0; i < schedule.length; i++) {
    const cuota = schedule[i];
    const entry = await upsertEntry({
      employeeId: input.employeeId,
      periodYear: cuota.period.year,
      periodMonth: cuota.period.month,
      periodHalf: cuota.period.half,
    });
    const ledgerEntry = await createLedgerEntry({
      employeeId: input.employeeId,
      category: input.category,
      direction: "payment",
      amountCents: cuota.amountCents,
      entryDate: periodApproxDate(cuota.period).toISOString().slice(0, 10),
      payrollEntryId: entry.id,
      loanId,
      notes: numInstallments > 1 ? `Cuota ${i + 1} de ${numInstallments}` : null,
    });
    installments.push({
      ledgerEntryId: ledgerEntry.id,
      period: cuota.period,
      amountCents: cuota.amountCents,
      paid: entry.paid,
    });
  }

  return { ...mapLoan(loanRow), installments };
}

/** Todos los préstamos de un empleado, con su calendario resuelto de
 *  las filas reales de ledger vinculadas por loan_id. */
export async function getLoansForEmployee(employeeId: string): Promise<PayrollLoanWithSchedule[]> {
  const supabase = await createClient();
  const { data: loanRows, error } = await supabase
    .from("payroll_loans")
    .select("*")
    .eq("employee_id", employeeId)
    .order("request_date", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: ledgerRows, error: e2 } = await supabase
    .from("payroll_ledger_entries")
    .select("id, amount_cents, loan_id, payroll_entry_id")
    .eq("employee_id", employeeId)
    .eq("direction", "payment")
    .not("loan_id", "is", null);
  if (e2) throw new Error(e2.message);

  const entryIds = [...new Set((ledgerRows ?? []).map((r) => r.payroll_entry_id).filter((x): x is string => !!x))];
  const entryById = new Map<string, { period_year: number; period_month: number; period_half: number; paid: boolean }>();
  if (entryIds.length > 0) {
    const { data: entryRows, error: e3 } = await supabase
      .from("payroll_entries")
      .select("id, period_year, period_month, period_half, paid")
      .in("id", entryIds);
    if (e3) throw new Error(e3.message);
    for (const e of entryRows ?? []) entryById.set(e.id, e);
  }

  const installmentsByLoan = new Map<string, PayrollLoanInstallment[]>();
  for (const r of ledgerRows ?? []) {
    if (!r.loan_id || !r.payroll_entry_id) continue;
    const e = entryById.get(r.payroll_entry_id);
    if (!e) continue;
    const list = installmentsByLoan.get(r.loan_id) ?? [];
    list.push({
      ledgerEntryId: r.id,
      period: { year: e.period_year, month: e.period_month, half: e.period_half === 2 ? 2 : 1 },
      amountCents: r.amount_cents,
      paid: e.paid,
    });
    installmentsByLoan.set(r.loan_id, list);
  }

  return (loanRows ?? []).map((r) => ({ ...mapLoan(r), installments: installmentsByLoan.get(r.id) ?? [] }));
}

/** Cancela un préstamo y borra las cuotas que aún no se pagaron (su
 *  quincena tiene paid = false). Las ya pagadas nunca se tocan. */
export async function cancelLoan(loanId: string): Promise<void> {
  const supabase = await createClient();
  const { data: ledgerRows, error } = await supabase
    .from("payroll_ledger_entries")
    .select("id, payroll_entry_id, direction, category, amount_cents")
    .eq("loan_id", loanId);
  if (error) throw new Error(error.message);

  const entryIds = [...new Set((ledgerRows ?? []).map((r) => r.payroll_entry_id).filter((x): x is string => !!x))];
  const paidById = new Map<string, boolean>();
  if (entryIds.length > 0) {
    const { data: entryRows, error: e2 } = await supabase
      .from("payroll_entries")
      .select("id, paid")
      .in("id", entryIds);
    if (e2) throw new Error(e2.message);
    for (const e of entryRows ?? []) paidById.set(e.id, e.paid);
  }

  const toDelete = (ledgerRows ?? [])
    .filter((r) => r.payroll_entry_id && paidById.get(r.payroll_entry_id) === false)
    .map((r) => r.id);
  if (toDelete.length > 0) {
    const { error: e3 } = await supabase.from("payroll_ledger_entries").delete().in("id", toDelete);
    if (e3) throw new Error(e3.message);
  }

  // Intereses: solo cuenta lo que se alcanzó a cobrar. Se reparte en proporción
  // a lo pagado (las cuotas pagadas cubren principal e intereses a la par); lo
  // que quede sin cobrar se perdona, igual que las cuotas que se cancelan.
  const interestRow = (ledgerRows ?? []).find((r) => r.category === "interes" && r.direction === "debt");
  if (interestRow) {
    const paidCents = (ledgerRows ?? [])
      .filter((r) => r.direction === "payment" && r.payroll_entry_id && paidById.get(r.payroll_entry_id) === true)
      .reduce((sum, r) => sum + r.amount_cents, 0);
    const { data: loanRow, error: eLoan } = await supabase
      .from("payroll_loans")
      .select("principal_cents, interest_cents")
      .eq("id", loanId)
      .single();
    if (eLoan) throw new Error(eLoan.message);
    const total = loanRow.principal_cents + (loanRow.interest_cents ?? 0);
    const collected = total > 0 ? Math.round((loanRow.interest_cents ?? 0) * Math.min(paidCents / total, 1)) : 0;
    if (collected <= 0) {
      const { error: eDel } = await supabase.from("payroll_ledger_entries").delete().eq("id", interestRow.id);
      if (eDel) throw new Error(eDel.message);
    } else if (collected !== interestRow.amount_cents) {
      const { error: eUpd } = await supabase.from("payroll_ledger_entries").update({ amount_cents: collected }).eq("id", interestRow.id);
      if (eUpd) throw new Error(eUpd.message);
    }
    const { error: eInt } = await supabase.from("payroll_loans").update({ interest_cents: collected }).eq("id", loanId);
    if (eInt) throw new Error(eInt.message);
  }

  const { error: e4 } = await supabase.from("payroll_loans").update({ status: "cancelled" }).eq("id", loanId);
  if (e4) throw new Error(e4.message);
}

/**
 * Edita una cuota PENDIENTE (no pagada) de un préstamo — el monto se
 * puede bajar (incluso a $0, "saltarla") o subir (un abono de más). El
 * resto del calendario pendiente se reacomoda con `reflowLoanSchedule`
 * (`lib/planilla/payroll-loans.ts`, pura) para que la suma de lo que
 * falta siga cuadrando exacto con el saldo pendiente. Las cuotas YA
 * PAGADAS (`payroll_entries.paid`) ni siquiera se cargan acá — quedan
 * intactas.
 *
 * Igual patrón que `createLoan` para materializar una cuota nueva:
 * primero la quincena real (`upsertEntry`, la crea si no existe), luego
 * la fila de ledger enganchada a ella.
 */
export async function reflowLoanInstallment(input: {
  loanId: string;
  employeeId: string;
  ledgerEntryId: string;
  newAmountCents: number;
  mode?: ReflowMode;
}): Promise<void> {
  const supabase = await createClient();

  const { data: ledgerRows, error } = await supabase
    .from("payroll_ledger_entries")
    .select("id, amount_cents, payroll_entry_id")
    .eq("loan_id", input.loanId)
    .eq("direction", "payment");
  if (error) throw new Error(error.message);

  const entryIds = [...new Set((ledgerRows ?? []).map((r) => r.payroll_entry_id).filter((x): x is string => !!x))];
  const entryById = new Map<string, { period_year: number; period_month: number; period_half: number; paid: boolean }>();
  if (entryIds.length > 0) {
    const { data: entryRows, error: e2 } = await supabase
      .from("payroll_entries")
      .select("id, period_year, period_month, period_half, paid")
      .in("id", entryIds);
    if (e2) throw new Error(e2.message);
    for (const e of entryRows ?? []) entryById.set(e.id, e);
  }

  // Solo las NO pagadas entran al reflow — las pagadas se filtran acá y
  // quedan fuera de la conversación por completo.
  const pending: PendingInstallment[] = [];
  for (const r of ledgerRows ?? []) {
    if (!r.payroll_entry_id) continue;
    const e = entryById.get(r.payroll_entry_id);
    if (!e || e.paid) continue;
    pending.push({
      ledgerEntryId: r.id,
      period: { year: e.period_year, month: e.period_month, half: e.period_half === 2 ? 2 : 1 },
      amountCents: r.amount_cents,
    });
  }

  const reflowed = reflowLoanSchedule(pending, input.ledgerEntryId, input.newAmountCents, input.mode ?? "extend");
  const reflowedById = new Map(
    reflowed.filter((r): r is typeof r & { ledgerEntryId: string } => r.ledgerEntryId !== null).map((r) => [r.ledgerEntryId, r])
  );
  const newOnes = reflowed.filter((r) => r.ledgerEntryId === null);

  // Cuotas pendientes que el reflow consumió por completo (o la propia
  // editada, si quedó en $0) — se borran.
  const toDelete = pending.filter((p) => !reflowedById.has(p.ledgerEntryId)).map((p) => p.ledgerEntryId);
  if (toDelete.length > 0) {
    const { error: eDel } = await supabase.from("payroll_ledger_entries").delete().in("id", toDelete);
    if (eDel) throw new Error(eDel.message);
  }

  // Cuotas que se conservan pero cambiaron de monto.
  for (const p of pending) {
    const next = reflowedById.get(p.ledgerEntryId);
    if (next && next.amountCents !== p.amountCents) {
      const { error: eUpd } = await supabase
        .from("payroll_ledger_entries")
        .update({ amount_cents: next.amountCents })
        .eq("id", p.ledgerEntryId);
      if (eUpd) throw new Error(eUpd.message);
    }
  }

  // Cuotas nuevas al final del calendario (el reflow alargó el
  // préstamo) — mismo patrón que createLoan: la quincena real primero.
  if (newOnes.length > 0) {
    const { data: loanRow, error: eLoan } = await supabase
      .from("payroll_loans")
      .select("category")
      .eq("id", input.loanId)
      .single();
    if (eLoan) throw new Error(eLoan.message);
    const category = toLoanCategory(loanRow.category);

    for (const n of newOnes) {
      const entry = await upsertEntry({
        employeeId: input.employeeId,
        periodYear: n.period.year,
        periodMonth: n.period.month,
        periodHalf: n.period.half,
      });
      await createLedgerEntry({
        employeeId: input.employeeId,
        category,
        direction: "payment",
        amountCents: n.amountCents,
        entryDate: periodApproxDate(n.period).toISOString().slice(0, 10),
        payrollEntryId: entry.id,
        loanId: input.loanId,
        notes: "Cuota agregada al reacomodar el calendario",
      });
    }
  }
}

/** Mueve una sola cuota pendiente a otra quincena sin cambiar monto ni saldo. */
export async function moveLoanInstallment(input: {
  loanId: string;
  ledgerEntryId: string;
  period: Period;
}): Promise<void> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("payroll_ledger_entries")
    .select("id, employee_id, category, amount_cents, payroll_entry_id")
    .eq("id", input.ledgerEntryId)
    .eq("loan_id", input.loanId)
    .eq("direction", "payment")
    .single();
  if (error) throw new Error(error.message);
  if (!row.payroll_entry_id) throw new Error("La cuota no está asociada a una quincena");

  const { data: oldEntry, error: oldError } = await supabase
    .from("payroll_entries")
    .select("id, paid")
    .eq("id", row.payroll_entry_id)
    .single();
  if (oldError) throw new Error(oldError.message);
  if (oldEntry.paid) throw new Error("No se puede mover una cuota ya pagada");

  const entry = await upsertEntry({
    employeeId: row.employee_id,
    periodYear: input.period.year,
    periodMonth: input.period.month,
    periodHalf: input.period.half,
  });
  const { error: updateError } = await supabase
    .from("payroll_ledger_entries")
    .update({ payroll_entry_id: entry.id, entry_date: periodApproxDate(input.period).toISOString().slice(0, 10) })
    .eq("id", input.ledgerEntryId);
  if (updateError) throw new Error(updateError.message);
}

/** Borra un préstamo/adelanto/herramienta/daño COMPLETO: sus cuotas (pagadas
 *  o no), el monto otorgado y el préstamo mismo. Para un registro que nunca
 *  debió existir; para cortar uno vigente está `cancelLoan`. */
/** Borra un préstamo y todo su rastro — solo si ninguna cuota se ha pagado
 *  (se registró por error). Si ya hay pagos, se perdona el saldo (`cancelLoan`). */
export async function deleteLoan(loanId: string): Promise<void> {
  const supabase = await createClient();
  const { data: rows, error: e0 } = await supabase
    .from("payroll_ledger_entries")
    .select("payroll_entry_id")
    .eq("loan_id", loanId)
    .not("payroll_entry_id", "is", null);
  if (e0) throw new Error(e0.message);
  const entryIds = [...new Set((rows ?? []).map((r) => r.payroll_entry_id as string))];
  if (entryIds.length > 0) {
    const { count, error: e1 } = await supabase
      .from("payroll_entries")
      .select("id", { count: "exact", head: true })
      .in("id", entryIds)
      .eq("paid", true);
    if (e1) throw new Error(e1.message);
    if ((count ?? 0) > 0) throw new Error("Ya tiene cuotas pagadas: perdona el saldo en vez de eliminarlo.");
  }
  const { error } = await supabase.from("payroll_ledger_entries").delete().eq("loan_id", loanId);
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("payroll_loans").delete().eq("id", loanId);
  if (e2) throw new Error(e2.message);
}

/** Edita un préstamo cambiando monto, cuotas, esquema o quincena de inicio:
 *  se arma el nuevo calendario y se retira el anterior. Solo si ninguna
 *  cuota se ha pagado todavía (si no, habría que reescribir historia). */
export async function replaceLoan(
  loanId: string,
  input: Parameters<typeof createLoan>[0]
): Promise<PayrollLoanWithSchedule> {
  const existing = (await getLoansForEmployee(input.employeeId)).find((l) => l.id === loanId);
  if (!existing) throw new Error("Préstamo no encontrado");
  if (existing.installments.some((i) => i.paid)) {
    throw new Error("Este préstamo ya tiene cuotas pagadas y no se puede reescribir.");
  }
  const created = await createLoan(input);
  await deleteLoan(loanId);
  return created;
}

/** Solo las notas — sirve aunque el préstamo ya tenga cuotas pagadas. */
export async function updateLoanNotes(loanId: string, notes: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_loans").update({ notes }).eq("id", loanId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Vista general de préstamos (todos los empleados)
// ============================================================================

/** Todos los préstamos/adelantos/herramientas/daños/InDrive de la empresa con su
 *  avance: cuántas cuotas van pagadas, cuánto falta y cuándo termina. */
export async function getLoansOverview(): Promise<LoanOverviewRow[]> {
  const supabase = await createClient();
  const [loans, ledger, entries] = await Promise.all([
    selectAllRows((from, to) => supabase.from("payroll_loans").select("*").order("id").range(from, to)),
    selectAllRows((from, to) =>
      supabase
        .from("payroll_ledger_entries")
        .select("id, loan_id, amount_cents, payroll_entry_id")
        .eq("direction", "payment")
        .not("loan_id", "is", null)
        .order("id")
        .range(from, to)
    ),
    selectAllRows((from, to) =>
      supabase.from("payroll_entries").select("id, period_year, period_month, period_half, paid").order("id").range(from, to)
    ),
  ]);

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const installmentsByLoan = new Map<string, { period: Period; amountCents: number; paid: boolean }[]>();
  for (const r of ledger) {
    if (!r.loan_id || !r.payroll_entry_id) continue;
    const e = entryById.get(r.payroll_entry_id);
    if (!e) continue;
    const list = installmentsByLoan.get(r.loan_id) ?? [];
    list.push({
      period: { year: e.period_year, month: e.period_month, half: e.period_half === 2 ? 2 : 1 },
      amountCents: r.amount_cents,
      paid: e.paid,
    });
    installmentsByLoan.set(r.loan_id, list);
  }

  return loans.map((l) => {
    const inst = (installmentsByLoan.get(l.id) ?? []).sort(
      (a, b) => periodOrdinal(a.period.year, a.period.month, a.period.half) - periodOrdinal(b.period.year, b.period.month, b.period.half)
    );
    const pending = inst.filter((i) => !i.paid);
    return {
      loanId: l.id,
      employeeId: l.employee_id,
      category: toLoanCategory(l.category),
      status: l.status === "cancelled" ? "cancelled" : "active",
      paymentMethod: (l.payment_method as LoanPaymentMethod) ?? "cuota_fija",
      requestDate: l.request_date,
      principalCents: l.principal_cents,
      interestCents: l.interest_cents ?? 0,
      installmentCount: inst.length,
      paidCount: inst.length - pending.length,
      paidCents: inst.filter((i) => i.paid).reduce((s, i) => s + i.amountCents, 0),
      pendingCents: pending.reduce((s, i) => s + i.amountCents, 0),
      next: pending[0] ? { period: pending[0].period, amountCents: pending[0].amountCents } : null,
      last: inst.length > 0 ? inst[inst.length - 1].period : null,
    };
  });
}

// ============================================================================
// Limpiar las horas de una quincena (para rehacer una importación de asistencia)
// ============================================================================

/** Deja en 0 las horas y días descontados y las horas extra de TODOS los empleados
 *  de la quincena. No toca nada más (base, bonos, viáticos, préstamos,
 *  prestaciones). Devuelve cuántas filas cambió. */
export async function clearPeriodHours(year: number, month: number, half: 1 | 2): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_entries")
    .update({
      horas_descontadas: 0,
      horas_descontadas_cents: 0,
      dias_descontados: 0,
      dias_descontados_cents: 0,
      extra_hours: 0,
      extra_hours_cents: 0,
    })
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("period_half", half)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
