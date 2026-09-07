import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { PayrollEmployee } from "@/types/planilla";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { periodFromDateString } from "@/lib/planilla/payroll-accruals";
import { insertInitialSalaryChange, recomputeCurrentSalary } from "@/services/payroll-salary";

/**
 * Capa de datos de empleados de planilla — portada de Atlas
 * `src/services/employees.ts`, de SQLite síncrono a Supabase async.
 * La tabla es `payroll_employees` (RLS solo-admin); sin `propertyId`
 * (Ebony es una sola empresa).
 *
 * SUELDO: `base_salary_cents` / `benefits_base_salary_cents` son solo un
 * REFLEJO del sueldo vigente hoy, recalculado desde
 * `payroll_salary_changes` (ver `payroll-salary.ts`). Ningún formulario
 * los edita: al crear un empleado se inserta su primera fila de
 * historial, y los aumentos se registran aparte.
 *
 * El "activar/desactivar" y la liquidación pasan por
 * `updatePayrollEmployee` (patch de `status` / `endDate` /
 * `liquidationNotes`), como en Atlas. `deletePayrollEmployee` borra al
 * empleado y toda su historia por cascada.
 */

type Row = Database["public"]["Tables"]["payroll_employees"]["Row"];

function mapEmployee(r: Row): PayrollEmployee {
  return {
    id: r.id,
    name: r.name,
    position: r.position,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    baseSalaryCents: r.base_salary_cents,
    benefitsBaseSalaryCents: r.benefits_base_salary_cents,
    notes: r.notes,
    liquidationNotes: r.liquidation_notes,
    sortOrder: r.sort_order,
    phone: r.phone,
    idDocument: r.id_document,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    contractInfo: r.contract_info,
  };
}

/** Activos primero, luego por `sort_order`, luego por nombre. */
export async function getPayrollEmployees(): Promise<PayrollEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_employees")
    .select("*")
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEmployee);
}

export async function getPayrollEmployee(id: string): Promise<PayrollEmployee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payroll_employees").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEmployee(data) : null;
}

export interface CreatePayrollEmployeeInput {
  name: string;
  position?: string | null;
  startDate?: string | null;
  /** Sueldo mensual inicial. Se guarda como la primera fila del
   *  historial (vigente desde la quincena de `startDate`, o la quincena
   *  actual si no hay fecha de ingreso). NO se vuelve a editar por
   *  formulario: los cambios son aumentos registrados aparte. */
  baseSalaryCents?: number;
  benefitsBaseSalaryCents?: number | null;
  notes?: string | null;
  phone?: string | null;
  idDocument?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
}

export async function createPayrollEmployee(input: CreatePayrollEmployeeInput): Promise<PayrollEmployee> {
  const supabase = await createClient();
  const { data: maxRow, error: maxErr } = await supabase
    .from("payroll_employees")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw new Error(maxErr.message);
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("payroll_employees")
    .insert({
      name: input.name,
      position: input.position ?? null,
      start_date: input.startDate ?? null,
      // Reflejo inicial; recompute lo confirma abajo desde el historial.
      base_salary_cents: input.baseSalaryCents ?? 0,
      benefits_base_salary_cents: input.benefitsBaseSalaryCents ?? null,
      notes: input.notes ?? null,
      phone: input.phone ?? null,
      id_document: input.idDocument ?? null,
      emergency_contact_name: input.emergencyContactName ?? null,
      emergency_contact_phone: input.emergencyContactPhone ?? null,
      contract_info: input.contractInfo ?? null,
      sort_order: nextSort,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Primera fila del historial de sueldos — vigente desde el ingreso.
  const eff = (input.startDate ? periodFromDateString(input.startDate) : null) ?? currentPeriod();
  await insertInitialSalaryChange({
    employeeId: data.id,
    monthlySalaryCents: input.baseSalaryCents ?? 0,
    benefitsBaseSalaryCents: input.benefitsBaseSalaryCents ?? null,
    effectiveYear: eff.year,
    effectiveMonth: eff.month,
    effectiveHalf: eff.half,
    notes: null,
  });
  await recomputeCurrentSalary(data.id);

  return mapEmployee({
    ...data,
    base_salary_cents: input.baseSalaryCents ?? 0,
    benefits_base_salary_cents: input.benefitsBaseSalaryCents ?? null,
  });
}

export interface UpdatePayrollEmployeeInput {
  name?: string;
  position?: string | null;
  startDate?: string | null;
  /** Fin de empleo / ancla de reinicio de prestaciones (liquidación). */
  endDate?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  liquidationNotes?: string | null;
  notes?: string | null;
  phone?: string | null;
  idDocument?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
  // NOTA: sin baseSalaryCents / benefitsBaseSalaryCents a propósito. El
  // sueldo solo se cambia registrando un aumento en payroll_salary_changes.
}

/** Patch parcial (una key `undefined` se deja como está). El trigger
 *  `payroll_employees_touch_updated_at` mantiene `updated_at`. */
export async function updatePayrollEmployee(id: string, input: UpdatePayrollEmployeeInput): Promise<void> {
  const patch: Database["public"]["Tables"]["payroll_employees"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.position !== undefined) patch.position = input.position;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.liquidationNotes !== undefined) patch.liquidation_notes = input.liquidationNotes;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.idDocument !== undefined) patch.id_document = input.idDocument;
  if (input.emergencyContactName !== undefined) patch.emergency_contact_name = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) patch.emergency_contact_phone = input.emergencyContactPhone;
  if (input.contractInfo !== undefined) patch.contract_info = input.contractInfo;

  if (Object.keys(patch).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_employees").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra por completo al empleado. Por el `on delete cascade` de las 4
 *  tablas hijas, esto elimina también sus payroll_entries,
 *  payroll_ledger_entries, payroll_loans y payroll_salary_changes.
 *  Irreversible — la UI pide confirmación explícita antes de llamar. */
export async function deletePayrollEmployee(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
