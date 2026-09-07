import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { PayrollSalaryChange } from "@/types/planilla";
import { currentPeriod, periodOrdinal } from "@/lib/planilla/payroll-period";
import { earliestSalary, salaryInEffect, type SalaryChange } from "@/lib/planilla/salary-history";

/**
 * Capa de datos del historial de sueldos (`payroll_salary_changes`).
 * Es el ÚNICO lugar que escribe el sueldo de un empleado.
 * `payroll_employees.base_salary_cents` / `benefits_base_salary_cents`
 * se recalculan desde acá (ver `recomputeCurrentSalary`) — nunca los
 * setea un formulario.
 */

type Row = Database["public"]["Tables"]["payroll_salary_changes"]["Row"];

function mapChange(r: Row): PayrollSalaryChange {
  return {
    id: r.id,
    employeeId: r.employee_id,
    monthlySalaryCents: r.monthly_salary_cents,
    benefitsBaseSalaryCents: r.benefits_base_salary_cents,
    effectiveYear: r.effective_year,
    effectiveMonth: r.effective_month,
    effectiveHalf: r.effective_half === 2 ? 2 : 1,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/** Forma que consume el helper puro `src/lib/planilla/salary-history.ts`. */
export function toSalaryChanges(rows: PayrollSalaryChange[]): SalaryChange[] {
  return rows.map((c) => ({
    monthlySalaryCents: c.monthlySalaryCents,
    benefitsBaseSalaryCents: c.benefitsBaseSalaryCents,
    effectiveYear: c.effectiveYear,
    effectiveMonth: c.effectiveMonth,
    effectiveHalf: c.effectiveHalf,
  }));
}

/** Historial de un empleado, ordenado por quincena efectiva ascendente. */
export async function getSalaryChanges(employeeId: string): Promise<PayrollSalaryChange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_salary_changes")
    .select("*")
    .eq("employee_id", employeeId)
    .order("effective_year", { ascending: true })
    .order("effective_month", { ascending: true })
    .order("effective_half", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapChange);
}

/** Todos los historiales, agrupados por empleado (1 query) — para
 *  Registro y los reportes. */
export async function getAllSalaryChanges(): Promise<Map<string, PayrollSalaryChange[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_salary_changes")
    .select("*")
    .order("effective_year", { ascending: true })
    .order("effective_month", { ascending: true })
    .order("effective_half", { ascending: true });
  if (error) throw new Error(error.message);
  const byEmployee = new Map<string, PayrollSalaryChange[]>();
  for (const r of data ?? []) {
    const list = byEmployee.get(r.employee_id) ?? [];
    list.push(mapChange(r));
    byEmployee.set(r.employee_id, list);
  }
  return byEmployee;
}

/** Reescribe `payroll_employees.{base_salary_cents, benefits_base_salary_cents}`
 *  como REFLEJO del sueldo vigente hoy (con fallback al sueldo inicial si
 *  todo el historial es futuro). Se llama tras cada cambio del historial y
 *  tras crear al empleado. Update directo — no pasa por
 *  `updatePayrollEmployee`, que ya no acepta sueldo. */
export async function recomputeCurrentSalary(employeeId: string): Promise<void> {
  const changes = toSalaryChanges(await getSalaryChanges(employeeId));
  const now = currentPeriod();
  const current = salaryInEffect(changes, now.year, now.month, now.half) ?? earliestSalary(changes);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_employees")
    .update({
      base_salary_cents: current?.monthlySalaryCents ?? 0,
      benefits_base_salary_cents: current?.benefitsBaseSalaryCents ?? null,
    })
    .eq("id", employeeId);
  if (error) throw new Error(error.message);
}

export interface RegisterSalaryChangeInput {
  employeeId: string;
  monthlySalaryCents: number;
  benefitsBaseSalaryCents?: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveHalf: 1 | 2;
  notes?: string | null;
}

/** Registra un aumento (o edita el de esa quincena — upsert sobre la
 *  constraint UNIQUE por empleado+quincena efectiva) y recalcula el
 *  reflejo del sueldo actual. */
export async function registerSalaryChange(input: RegisterSalaryChangeInput): Promise<PayrollSalaryChange> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_salary_changes")
    .upsert(
      {
        employee_id: input.employeeId,
        monthly_salary_cents: input.monthlySalaryCents,
        benefits_base_salary_cents: input.benefitsBaseSalaryCents ?? null,
        effective_year: input.effectiveYear,
        effective_month: input.effectiveMonth,
        effective_half: input.effectiveHalf,
        notes: input.notes ?? null,
      },
      { onConflict: "employee_id,effective_year,effective_month,effective_half" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await recomputeCurrentSalary(input.employeeId);
  return mapChange(data);
}

/** La fila inicial que se crea junto con el empleado (vigente desde su
 *  fecha de ingreso). Igual que `registerSalaryChange` pero sin
 *  recompute (el caller lo hace una vez al final del alta). */
export async function insertInitialSalaryChange(input: RegisterSalaryChangeInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_salary_changes").insert({
    employee_id: input.employeeId,
    monthly_salary_cents: input.monthlySalaryCents,
    benefits_base_salary_cents: input.benefitsBaseSalaryCents ?? null,
    effective_year: input.effectiveYear,
    effective_month: input.effectiveMonth,
    effective_half: input.effectiveHalf,
    notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Ordinal de quincena — reexport de conveniencia. */
export { periodOrdinal };
