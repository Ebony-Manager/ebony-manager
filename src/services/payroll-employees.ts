import "server-only";

import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "./photos";
import type { Database } from "@/types/database";
import type { BankAccountType, EmployeeCategoria, PayrollEmployee } from "@/types/planilla";
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
    categoria: r.categoria === "administrativo" ? "administrativo" : "taller",
    baseSalaryCents: r.base_salary_cents,
    benefitsBaseSalaryCents: r.benefits_base_salary_cents,
    // Columna nueva (migración 20261014120000): `?? true` mantiene la app andando sin ella.
    benefitsEnabled: r.benefits_enabled ?? true,
    benefitsExternalCompany: r.benefits_external_company ?? null,
    notes: r.notes,
    liquidationNotes: r.liquidation_notes,
    sortOrder: r.sort_order,
    phone: r.phone,
    idDocument: r.id_document,
    // Las 4 columnas nuevas pueden no existir todavía si la migración
    // 20261008120000 no se ha aplicado: `?? null` mantiene la app andando.
    idDocumentType: r.id_document_type === "cedula" || r.id_document_type === "pasaporte" ? r.id_document_type : null,
    nationality: r.nationality ?? null,
    birthDate: r.birth_date ?? null,
    photoPath: r.photo_path ?? null,
    idDocumentPath: r.id_document_path ?? null,
    email: r.email ?? null,
    address: r.address ?? null,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    contractInfo: r.contract_info,
    bankName: r.bank_name,
    bankAccountType: r.bank_account_type === "ahorro" || r.bank_account_type === "corriente" ? r.bank_account_type : null,
    bankAccountNumber: r.bank_account_number,
    bankRoutingCode: r.bank_routing_code,
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
  /** 'taller' | 'administrativo' — default 'taller' si se omite, igual
   *  que la columna en la base (NOT NULL, mismo criterio que `status`). */
  categoria?: EmployeeCategoria;
  startDate?: string | null;
  /** Sueldo mensual inicial. Se guarda como la primera fila del
   *  historial (vigente desde la quincena de `startDate`, o la quincena
   *  actual si no hay fecha de ingreso). NO se vuelve a editar por
   *  formulario: los cambios son aumentos registrados aparte. */
  baseSalaryCents?: number;
  benefitsBaseSalaryCents?: number | null;
  benefitsEnabled?: boolean;
  benefitsExternalCompany?: string | null;
  notes?: string | null;
  phone?: string | null;
  idDocument?: string | null;
  idDocumentType?: "cedula" | "pasaporte" | null;
  nationality?: string | null;
  birthDate?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
  bankName?: string | null;
  bankAccountType?: BankAccountType | null;
  bankAccountNumber?: string | null;
  bankRoutingCode?: string | null;
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
      categoria: input.categoria ?? "taller",
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
      bank_name: input.bankName ?? null,
      bank_account_type: input.bankAccountType ?? null,
      bank_account_number: input.bankAccountNumber ?? null,
      bank_routing_code: input.bankRoutingCode ?? null,
      // Columnas nuevas: solo se mandan si vienen con valor, así crear un
      // empleado sigue funcionando aunque la migración aún no se aplique.
      ...(input.idDocumentType ? { id_document_type: input.idDocumentType } : {}),
      ...(input.nationality ? { nationality: input.nationality } : {}),
      ...(input.birthDate ? { birth_date: input.birthDate } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.benefitsEnabled === false ? { benefits_enabled: false } : {}),
      ...(input.benefitsExternalCompany ? { benefits_external_company: input.benefitsExternalCompany } : {}),
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
  /** 'taller' | 'administrativo' — NOT NULL en la base, mismo criterio
   *  que `status`: no acepta null, solo se omite si no cambia. */
  categoria?: EmployeeCategoria;
  startDate?: string | null;
  /** Fin de empleo / ancla de reinicio de prestaciones (liquidación). */
  endDate?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  liquidationNotes?: string | null;
  benefitsEnabled?: boolean;
  benefitsExternalCompany?: string | null;
  notes?: string | null;
  phone?: string | null;
  idDocument?: string | null;
  idDocumentType?: "cedula" | "pasaporte" | null;
  nationality?: string | null;
  birthDate?: string | null;
  photoPath?: string | null;
  idDocumentPath?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
  bankName?: string | null;
  bankAccountType?: BankAccountType | null;
  bankAccountNumber?: string | null;
  bankRoutingCode?: string | null;
  // NOTA: sin baseSalaryCents / benefitsBaseSalaryCents a propósito. El
  // sueldo solo se cambia registrando un aumento en payroll_salary_changes.
}

/** Patch parcial (una key `undefined` se deja como está). El trigger
 *  `payroll_employees_touch_updated_at` mantiene `updated_at`. */
export async function updatePayrollEmployee(id: string, input: UpdatePayrollEmployeeInput): Promise<void> {
  const patch: Database["public"]["Tables"]["payroll_employees"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.position !== undefined) patch.position = input.position;
  if (input.categoria !== undefined) patch.categoria = input.categoria;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.liquidationNotes !== undefined) patch.liquidation_notes = input.liquidationNotes;
  if (input.benefitsEnabled !== undefined) patch.benefits_enabled = input.benefitsEnabled;
  if (input.benefitsExternalCompany !== undefined) patch.benefits_external_company = input.benefitsExternalCompany;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.idDocument !== undefined) patch.id_document = input.idDocument;
  if (input.idDocumentType !== undefined) patch.id_document_type = input.idDocumentType;
  if (input.nationality !== undefined) patch.nationality = input.nationality;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate;
  if (input.photoPath !== undefined) patch.photo_path = input.photoPath;
  if (input.idDocumentPath !== undefined) patch.id_document_path = input.idDocumentPath;
  if (input.email !== undefined) patch.email = input.email;
  if (input.address !== undefined) patch.address = input.address;
  if (input.emergencyContactName !== undefined) patch.emergency_contact_name = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) patch.emergency_contact_phone = input.emergencyContactPhone;
  if (input.contractInfo !== undefined) patch.contract_info = input.contractInfo;
  if (input.bankName !== undefined) patch.bank_name = input.bankName;
  if (input.bankAccountType !== undefined) patch.bank_account_type = input.bankAccountType;
  if (input.bankAccountNumber !== undefined) patch.bank_account_number = input.bankAccountNumber;
  if (input.bankRoutingCode !== undefined) patch.bank_routing_code = input.bankRoutingCode;

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

/** URL firmada (1 h) de la foto de cada empleado que tenga una (ver signedPhotoUrls). */
export async function getEmployeePhotoUrls(employees: PayrollEmployee[]): Promise<Record<string, string>> {
  return signedPhotoUrls("employee-photos", employees);
}
