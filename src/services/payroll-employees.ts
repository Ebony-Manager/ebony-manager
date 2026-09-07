import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { PayrollEmployee } from "@/types/planilla";

/**
 * Capa de datos de empleados de planilla — portada de Atlas
 * `src/services/employees.ts`, de SQLite síncrono a Supabase async.
 * La tabla es `payroll_employees` (RLS solo-admin); sin `propertyId`
 * (Ebony es una sola empresa). El "activar/desactivar" y la liquidación
 * pasan por `updatePayrollEmployee` (patch de `status` / `endDate` /
 * `liquidationNotes`), como en Atlas.
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

/** Activos primero, luego por `sort_order`, luego por nombre — igual que
 *  Atlas ('ACTIVE' < 'INACTIVE' alfabéticamente, así ascendente pone los
 *  activos arriba). */
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
  return mapEmployee(data);
}

export interface UpdatePayrollEmployeeInput {
  name?: string;
  position?: string | null;
  startDate?: string | null;
  /** Fin de empleo / ancla de reinicio de prestaciones (liquidación). */
  endDate?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  liquidationNotes?: string | null;
  baseSalaryCents?: number;
  benefitsBaseSalaryCents?: number | null;
  notes?: string | null;
  phone?: string | null;
  idDocument?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
}

/** Solo escribe las columnas presentes en `input` (una key `undefined`
 *  se deja como está — misma semántica de merge que Atlas, expresada
 *  como patch parcial en vez de leer-y-reescribir toda la fila). El
 *  trigger `payroll_employees_touch_updated_at` mantiene `updated_at`. */
export async function updatePayrollEmployee(id: string, input: UpdatePayrollEmployeeInput): Promise<void> {
  const patch: Database["public"]["Tables"]["payroll_employees"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.position !== undefined) patch.position = input.position;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.liquidationNotes !== undefined) patch.liquidation_notes = input.liquidationNotes;
  if (input.baseSalaryCents !== undefined) patch.base_salary_cents = input.baseSalaryCents;
  if (input.benefitsBaseSalaryCents !== undefined) patch.benefits_base_salary_cents = input.benefitsBaseSalaryCents;
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
