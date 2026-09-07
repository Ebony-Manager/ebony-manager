import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { PayrollEmployee, PayrollEntry, PayrollPeriodTotal, PaymentMethod } from "@/types/planilla";
import { computePeriodTotalFromEntry } from "@/lib/planilla/payroll-accruals";
import { previousPeriod } from "@/lib/planilla/payroll-period";
import { getPayrollEmployees } from "@/services/payroll-employees";

/**
 * Capa de datos del Registro de quincena — portada de la parte
 * relevante de Atlas `src/services/payroll.ts`, de SQLite síncrono a
 * Supabase async. Las fórmulas (total de quincena, acumulados) NO se
 * reimplementan acá: se importan puras de `src/lib/planilla/`. Sin
 * `propertyId`. Los acumulados de Décimo/Vacación/Prima y las pantallas
 * que los usan (Resumen/Auditoría/Dashboard/Detalle) se portan en B2.
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
    paymentMethod: (r.payment_method as PaymentMethod) ?? "efectivo",
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
  basePayCents?: number;
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
 *  campos provistos sobre lo que ya haya (misma semántica que el
 *  `upsertEntry` de Atlas). `paid_at` se sella al guardar con `paid`. */
export async function upsertEntry(input: UpsertEntryInput): Promise<PayrollEntry> {
  const supabase = await createClient();
  const existing = await getEntryRow(
    supabase,
    input.employeeId,
    input.periodYear,
    input.periodMonth,
    input.periodHalf
  );
  const cur = existing ? mapEntry(existing) : null;

  const merged = {
    base_pay_cents: input.basePayCents ?? cur?.basePayCents ?? 0,
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
    payment_method: input.paymentMethod ?? cur?.paymentMethod ?? "efectivo",
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
): Promise<Map<string, { debt: number; payment: number }>> {
  const byEntry = new Map<string, { debt: number; payment: number }>();
  if (entryIds.length === 0) return byEntry;
  const { data, error } = await supabase
    .from("payroll_ledger_entries")
    .select("direction, amount_cents, payroll_entry_id")
    .in("payroll_entry_id", entryIds)
    .neq("category", "seguro_social");
  if (error) throw new Error(error.message);
  for (const l of data ?? []) {
    if (!l.payroll_entry_id) continue;
    const acc = byEntry.get(l.payroll_entry_id) ?? { debt: 0, payment: 0 };
    if (l.direction === "payment") acc.payment += l.amount_cents;
    else acc.debt += l.amount_cents;
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
  const entry = row ? mapEntry(row) : null;
  const ledger = row ? (await ledgerForEntryIds(supabase, [row.id])).get(row.id) ?? { debt: 0, payment: 0 } : { debt: 0, payment: 0 };
  return computePeriodTotalFromEntry(entry, ledger);
}

export interface RegistroRow {
  employee: PayrollEmployee;
  total: PayrollPeriodTotal;
}

/** Fuente de datos de la rejilla de Registro: una fila por empleado
 *  activo, con el total computado de esa quincena. Batchea todo el
 *  período en 2 queries (entries + ledger) en vez de una por empleado. */
export async function getRegistroForPeriod(year: number, month: number, half: 1 | 2): Promise<RegistroRow[]> {
  const supabase = await createClient();
  const employees = (await getPayrollEmployees()).filter((e) => e.status === "ACTIVE");

  const { data: entryRows, error } = await supabase
    .from("payroll_entries")
    .select("*")
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("period_half", half);
  if (error) throw new Error(error.message);

  const entryByEmployee = new Map<string, EntryRow>();
  for (const r of entryRows ?? []) entryByEmployee.set(r.employee_id, r);
  const ledgerByEntry = await ledgerForEntryIds(supabase, (entryRows ?? []).map((r) => r.id));

  return employees.map((employee) => {
    const row = entryByEmployee.get(employee.id) ?? null;
    const entry = row ? mapEntry(row) : null;
    const ledger = row ? ledgerByEntry.get(row.id) ?? { debt: 0, payment: 0 } : { debt: 0, payment: 0 };
    return { employee, total: computePeriodTotalFromEntry(entry, ledger) };
  });
}

/** "Duplicar quincena anterior": copia base + método de la quincena
 *  previa para cada empleado activo que todavía no tiene fila en la
 *  quincena destino. Nunca pisa una edición ya hecha. */
export async function duplicatePreviousPeriod(year: number, month: number, half: 1 | 2): Promise<number> {
  const prev = previousPeriod(year, month, half);
  const supabase = await createClient();
  const employees = (await getPayrollEmployees()).filter((e) => e.status === "ACTIVE");

  const { data: prevRows, error: prevErr } = await supabase
    .from("payroll_entries")
    .select("employee_id, base_pay_cents, payment_method")
    .eq("period_year", prev.year)
    .eq("period_month", prev.month)
    .eq("period_half", prev.half);
  if (prevErr) throw new Error(prevErr.message);

  const { data: targetRows, error: targetErr } = await supabase
    .from("payroll_entries")
    .select("employee_id")
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("period_half", half);
  if (targetErr) throw new Error(targetErr.message);

  const prevByEmployee = new Map((prevRows ?? []).map((r) => [r.employee_id, r]));
  const targetSet = new Set((targetRows ?? []).map((r) => r.employee_id));

  let copied = 0;
  for (const employee of employees) {
    if (targetSet.has(employee.id)) continue;
    const src = prevByEmployee.get(employee.id);
    if (!src) continue;
    await upsertEntry({
      employeeId: employee.id,
      periodYear: year,
      periodMonth: month,
      periodHalf: half,
      basePayCents: src.base_pay_cents,
      paymentMethod: (src.payment_method as PaymentMethod) ?? "efectivo",
    });
    copied += 1;
  }
  return copied;
}
