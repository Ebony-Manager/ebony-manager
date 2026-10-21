import "server-only";

import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "./photos";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { DashboardContractor, DashboardEntry } from "@/lib/contractors/dashboard";
import { installmentDate, isScheduled, todayInPanama } from "@/lib/contractors/contractor-loans";
import {
  computeLoanInterestCents,
  computeLoanSchedule,
  defaultLoanStartPeriod,
  isSingleInstallment,
  type LoanInterestInput,
} from "@/lib/planilla/payroll-loans";
import type { LoanCategory, LoanPaymentMethod } from "@/types/planilla";
import type { Database } from "@/types/database";
import type {
  Contractor,
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorHelper,
  ContractorLedgerEntryItem,
  ContractorLoanSummary,
  ContractorStatus,
  ContractorType,
  LaborRate,
  LaborRatePhase,
  LaborRateUnit,
  Project,
  ProjectStatus,
} from "@/types/contractors";

/**
 * Capa de datos del módulo Contratistas (tablas `contractors`,
 * `projects` y `contractor_ledger_entries`, RLS solo-admin). Módulo
 * hermano de Planilla; el saldo del contratista NUNCA se guarda — se
 * computa con `contractorBalanceCents`
 * (`src/lib/contractors/contractor-ledger.ts`).
 *
 * C2: proyectos (CRUD simple) enganchados a los movimientos por
 * `project_id`; inactivar / liquidar / borrar contratista. Borrar un
 * proyecto NO borra movimientos — el FK es `on delete set null`.
 */

type ContractorRow = Database["public"]["Tables"]["contractors"]["Row"];
type LedgerRow = Database["public"]["Tables"]["contractor_ledger_entries"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type LaborRateRow = Database["public"]["Tables"]["labor_rates"]["Row"];
type HelperRow = Database["public"]["Tables"]["contractor_helpers"]["Row"];
type LedgerEntryItemRow = Database["public"]["Tables"]["contractor_ledger_entry_items"]["Row"];

/** `numeric` de Postgres vuelve como string por PostgREST — se
 *  normaliza a number (o null). */
function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? Number(v) : v;
}

function mapContractor(r: ContractorRow): Contractor {
  return {
    id: r.id,
    name: r.name,
    contractorType: r.contractor_type === "pintor" ? "pintor" : "ebanista",
    idDocument: r.id_document,
    idDocumentType: r.id_document_type === "cedula" || r.id_document_type === "pasaporte" ? r.id_document_type : null,
    nationality: r.nationality,
    birthDate: r.birth_date,
    photoPath: r.photo_path,
    idDocumentPath: r.id_document_path,
    phone: r.phone,
    email: r.email,
    address: r.address,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    contractInfo: r.contract_info,
    bankName: r.bank_name,
    bankAccountType: r.bank_account_type === "ahorro" || r.bank_account_type === "corriente" ? r.bank_account_type : null,
    bankAccountNumber: r.bank_account_number,
    bankRoutingCode: r.bank_routing_code,
    startDate: r.start_date,
    status: r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    endDate: r.end_date,
    notes: r.notes,
    sortOrder: r.sort_order,
  };
}

/** "Descripción (detalle), Descripción 2, …" — resumen compacto para la
 *  columna "Descripción" del estado de cuenta cuando el movimiento tiene
 *  ítems. null si no tiene ninguno. */
function buildItemsSummary(items: { descripcion: string; detalle: string | null }[] | null | undefined): string | null {
  if (!items || items.length === 0) return null;
  return items.map((it) => (it.detalle ? `${it.descripcion} (${it.detalle})` : it.descripcion)).join(", ");
}

function mapLedger(
  r: LedgerRow,
  projectName: string | null = null,
  itemsSummary: string | null = null
): ContractorLedgerEntry {
  return {
    id: r.id,
    contractorId: r.contractor_id,
    projectId: r.project_id,
    projectName,
    entryDate: r.entry_date,
    category: r.category as ContractorLedgerCategory,
    direction: r.direction === "a_favor" ? "a_favor" : "reduce",
    mt2: num(r.mt2),
    costPerMt2Cents: r.cost_per_mt2_cents,
    amountCents: r.amount_cents,
    ebonyAbsorbsMaterial: r.ebony_absorbs_material,
    clientText: r.client_text,
    description: r.description,
    notes: r.notes,
    itemsSummary,
    loanId: r.loan_id,
  };
}

function mapLaborRate(r: LaborRateRow): LaborRate {
  return {
    id: r.id,
    contractorType: r.contractor_type === "pintor" ? "pintor" : "ebanista",
    fase: r.fase === "armado" || r.fase === "instalacion" ? r.fase : null,
    unidad: r.unidad as LaborRateUnit,
    descripcion: r.descripcion,
    precioCents: r.precio_cents,
    activo: r.activo,
    orden: r.orden,
  };
}

function mapLedgerEntryItem(r: LedgerEntryItemRow): ContractorLedgerEntryItem {
  return {
    id: r.id,
    ledgerEntryId: r.ledger_entry_id,
    laborRateId: r.labor_rate_id,
    descripcion: r.descripcion,
    detalle: r.detalle,
    fase: r.fase === "armado" || r.fase === "instalacion" ? r.fase : null,
    unidad: r.unidad as LaborRateUnit,
    precioUnitarioCents: r.precio_unitario_cents,
    cantidad: num(r.cantidad) ?? 0,
    subtotalCents: r.subtotal_cents,
  };
}

function mapProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    clientName: r.client_name,
    status: r.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
    notes: r.notes,
    scope: r.scope,
    furnitureType: r.furniture_type,
    materialColor: r.material_color,
    specs: r.specs,
    paymentTerms: r.payment_terms,
    totalMt2: num(r.total_mt2),
  };
}

/** URL firmada (1 h) de la foto de cada contratista que tenga una (ver signedPhotoUrls). */
export async function getContractorPhotoUrls(contractors: readonly Contractor[]): Promise<Record<string, string>> {
  return signedPhotoUrls("contractor-photos", contractors);
}

/** Contratistas (para la lista de Personal y para emparejar solicitudes de dinero). */
export async function getContractors(): Promise<Contractor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contractors").select("*").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContractor);
}

/** Datos crudos del dashboard de Contratistas: contratistas, TODOS sus
 *  movimientos (paginados, ver select-all.ts) y los nombres de proyecto. El
 *  cálculo (`computeContractorsDashboard`) se hace en el cliente, así cambiar
 *  de año es instantáneo y no vuelve a pedir nada al servidor. */
export async function getContractorsDashboardInput(): Promise<{
  loans: ContractorLoanSummary[];
  contractors: DashboardContractor[];
  entries: DashboardEntry[];
  projectNames: [string, string][];
}> {
  const supabase = await createClient();
  const [contractorsRes, rows, projectsRes] = await Promise.all([
    supabase.from("contractors").select("id, name, contractor_type, status").order("name"),
    selectAllRows((from, to) =>
      supabase
        .from("contractor_ledger_entries")
        .select("contractor_id, entry_date, category, direction, amount_cents, project_id, client_text, mt2, ebony_absorbs_material, loan_id")
        .order("id")
        .range(from, to)
    ),
    supabase.from("projects").select("id, name"),
  ]);
  if (contractorsRes.error) throw new Error(contractorsRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);
  const loans = await getContractorLoanSummaries(rows);
  // Las cuotas programadas (fecha futura) todavía no cuentan: ni en saldos ni en resúmenes.
  const today = todayInPanama();
  const due = rows.filter((r) => !isScheduled({ loanId: r.loan_id, entryDate: r.entry_date }, today));
  return {
    loans,
    contractors: (contractorsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      contractorType: c.contractor_type === "pintor" ? "pintor" : "ebanista",
      status: c.status,
    })),
    entries: due.map((r) => ({
      contractorId: r.contractor_id,
      entryDate: r.entry_date,
      category: r.category as DashboardEntry["category"],
      direction: r.direction === "a_favor" ? "a_favor" : "reduce",
      amountCents: r.amount_cents,
      projectId: r.project_id,
      clientText: r.client_text,
      mt2: r.mt2 === null ? null : Number(r.mt2),
      ebonyAbsorbsMaterial: r.ebony_absorbs_material,
      loanId: r.loan_id,
    })),
    projectNames: (projectsRes.data ?? []).map((p) => [p.id, p.name] as [string, string]),
  };
}

export async function getContractor(id: string): Promise<Contractor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contractors").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapContractor(data) : null;
}

/** Movimientos de un contratista, en orden cronológico (fecha, luego
 *  fecha de registro) — el mismo orden que espera `withRunningBalance`.
 *  Trae el nombre del proyecto enganchado en el mismo query. */
export async function getContractorLedger(contractorId: string): Promise<ContractorLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .select("*, projects(name), contractor_ledger_entry_items(descripcion, detalle)")
    .eq("contractor_id", contractorId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const { projects, contractor_ledger_entry_items, ...row } = r as LedgerRow & {
      projects: { name: string } | null;
      contractor_ledger_entry_items: { descripcion: string; detalle: string | null }[];
    };
    return mapLedger(row, projects?.name ?? null, buildItemsSummary(contractor_ledger_entry_items));
  });
}

// ============================================================================
// Proyectos — CRUD simple (C2). El FK del ledger es `on delete set null`:
// borrar un proyecto nunca borra un movimiento.
// ============================================================================

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProject);
}

/** Campos de "contrato" del proyecto (Etapa 2-A). Todos opcionales; se
 *  comparten entre crear y editar. */
export interface ProjectContractInput {
  scope?: string | null;
  furnitureType?: string | null;
  materialColor?: string | null;
  specs?: string | null;
  paymentTerms?: string | null;
  totalMt2?: number | null;
}

export interface CreateProjectInput extends ProjectContractInput {
  name: string;
  clientName?: string | null;
  status?: ProjectStatus;
  notes?: string | null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      client_name: input.clientName ?? null,
      status: input.status ?? "ACTIVE",
      notes: input.notes ?? null,
      scope: input.scope ?? null,
      furniture_type: input.furnitureType ?? null,
      material_color: input.materialColor ?? null,
      specs: input.specs ?? null,
      payment_terms: input.paymentTerms ?? null,
      total_mt2: input.totalMt2 ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProject(data);
}

export interface UpdateProjectInput extends ProjectContractInput {
  name?: string;
  clientName?: string | null;
  status?: ProjectStatus;
  notes?: string | null;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const patch: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.clientName !== undefined) patch.client_name = input.clientName;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.scope !== undefined) patch.scope = input.scope;
  if (input.furnitureType !== undefined) patch.furniture_type = input.furnitureType;
  if (input.materialColor !== undefined) patch.material_color = input.materialColor;
  if (input.specs !== undefined) patch.specs = input.specs;
  if (input.paymentTerms !== undefined) patch.payment_terms = input.paymentTerms;
  if (input.totalMt2 !== undefined) patch.total_mt2 = input.totalMt2;

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapProject(data);
}

/** Borra el proyecto. Los movimientos que lo tenían enganchado quedan
 *  con `project_id = NULL` (FK `on delete set null`) — nunca se borra
 *  plata por borrar un proyecto. */
export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Datos personales de la ficha (los mismos que la del empleado). */
export interface ContractorPersonalInput {
  idDocument?: string | null;
  idDocumentType?: Contractor["idDocumentType"];
  nationality?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  contractInfo?: string | null;
  bankName?: string | null;
  bankAccountType?: Contractor["bankAccountType"];
  bankAccountNumber?: string | null;
  bankRoutingCode?: string | null;
  startDate?: string | null;
}

export interface CreateContractorInput extends ContractorPersonalInput {
  name: string;
  contractorType: ContractorType;
}

/** Columna de la base de cada dato personal (para alta y edición). */
const PERSONAL_COLUMNS = {
  idDocument: "id_document",
  idDocumentType: "id_document_type",
  nationality: "nationality",
  birthDate: "birth_date",
  phone: "phone",
  email: "email",
  address: "address",
  emergencyContactName: "emergency_contact_name",
  emergencyContactPhone: "emergency_contact_phone",
  contractInfo: "contract_info",
  bankName: "bank_name",
  bankAccountType: "bank_account_type",
  bankAccountNumber: "bank_account_number",
  bankRoutingCode: "bank_routing_code",
  startDate: "start_date",
} as const satisfies Record<keyof ContractorPersonalInput, keyof Database["public"]["Tables"]["contractors"]["Update"]>;

/** Solo las keys presentes (`undefined` = no tocar), ya con nombre de columna. */
function personalPatch(input: ContractorPersonalInput): Database["public"]["Tables"]["contractors"]["Update"] {
  const patch: Database["public"]["Tables"]["contractors"]["Update"] = {};
  for (const key of Object.keys(PERSONAL_COLUMNS) as (keyof ContractorPersonalInput)[]) {
    if (input[key] !== undefined) patch[PERSONAL_COLUMNS[key]] = input[key] ?? null;
  }
  return patch;
}

export async function createContractor(input: CreateContractorInput): Promise<Contractor> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .insert({
      name: input.name,
      contractor_type: input.contractorType,
      ...personalPatch(input),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapContractor(data);
}

export interface UpdateContractorInput extends ContractorPersonalInput {
  name?: string;
  contractorType?: ContractorType;
  /** Nueva foto (ruta en contractor-photos) o null para quitarla. */
  photoPath?: string | null;
  /** Documento (ruta en staff-documents) o null para quitarlo. */
  idDocumentPath?: string | null;
  /** Salida del contratista: INACTIVE + `endDate` + `notes` documentan el
   *  cierre. La historia y el saldo NUNCA se borran por esto. */
  status?: ContractorStatus;
  endDate?: string | null;
  notes?: string | null;
}

/** Patch parcial (una key `undefined` se deja como está). El trigger
 *  `contractors_touch_updated_at` mantiene `updated_at`. */
export async function updateContractor(id: string, input: UpdateContractorInput): Promise<Contractor> {
  const patch = personalPatch(input);
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.contractorType !== undefined) patch.contractor_type = input.contractorType;
  if (input.photoPath !== undefined) patch.photo_path = input.photoPath;
  if (input.idDocumentPath !== undefined) patch.id_document_path = input.idDocumentPath;
  if (input.status !== undefined) patch.status = input.status;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.notes !== undefined) patch.notes = input.notes;

  const supabase = await createClient();
  const { data, error } = await supabase.from("contractors").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapContractor(data);
}

/** Borra por completo al contratista y TODO su estado de cuenta (el FK
 *  `contractor_id` del ledger es `on delete cascade`). Irreversible — la
 *  UI pide escribir el nombre exacto antes de llamar. */
export async function deleteContractor(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Un ítem de trabajo tal como lo arma el formulario — sin `id` ni
 *  `ledgerEntryId` (los pone la inserción). */
export interface LedgerEntryItemInput {
  laborRateId: string | null;
  descripcion: string;
  /** Nota opcional de la pieza específica de mueble (ej. "Mueble de TV"). */
  detalle: string | null;
  fase: LaborRatePhase | null;
  unidad: LaborRateUnit;
  precioUnitarioCents: number;
  cantidad: number;
  subtotalCents: number;
}

export interface UpsertLedgerEntryInput {
  contractorId: string;
  /** Proyecto enganchado (C2). null = sin proyecto. */
  projectId?: string | null;
  entryDate: string;
  category: ContractorLedgerCategory;
  direction: ContractorLedgerDirection;
  mt2?: number | null;
  costPerMt2Cents?: number | null;
  amountCents: number;
  ebonyAbsorbsMaterial?: boolean;
  clientText?: string | null;
  description?: string | null;
  notes?: string | null;
  /** Ítems de trabajo (categoría 'trabajo'). Si viene definido (incluso
   *  `[]`), REEMPLAZA todos los ítems del movimiento; si se omite, no se
   *  tocan — así otros flujos que no usan ítems (carga histórica, por
   *  ejemplo) no pierden nada por no mandarlos. */
  items?: LedgerEntryItemInput[];
}

/** Campos comunes de insert/update — normaliza el candado de negocio:
 *  `ebony_absorbs_material` solo puede ser true en `category = 'material'`
 *  (además del CHECK de la tabla). */
function ledgerFields(input: Omit<UpsertLedgerEntryInput, "contractorId">) {
  const isMaterial = input.category === "material";
  return {
    project_id: input.projectId ?? null,
    entry_date: input.entryDate,
    category: input.category,
    direction: input.direction,
    mt2: input.mt2 ?? null,
    cost_per_mt2_cents: input.costPerMt2Cents ?? null,
    amount_cents: input.amountCents,
    ebony_absorbs_material: isMaterial ? (input.ebonyAbsorbsMaterial ?? false) : false,
    client_text: input.clientText ?? null,
    description: input.description ?? null,
    notes: input.notes ?? null,
  };
}

/** Borra TODOS los ítems del movimiento y carga los nuevos — más simple
 *  que diffear línea por línea y evita ítems huérfanos. Se usa tanto al
 *  crear como al editar; el formulario siempre manda el set completo. */
async function replaceLedgerEntryItems(ledgerEntryId: string, items: LedgerEntryItemInput[]): Promise<void> {
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("contractor_ledger_entry_items")
    .delete()
    .eq("ledger_entry_id", ledgerEntryId);
  if (delError) throw new Error(delError.message);
  if (items.length === 0) return;
  const { error: insError } = await supabase.from("contractor_ledger_entry_items").insert(
    items.map((it) => ({
      ledger_entry_id: ledgerEntryId,
      labor_rate_id: it.laborRateId,
      descripcion: it.descripcion,
      detalle: it.detalle,
      fase: it.fase,
      unidad: it.unidad,
      precio_unitario_cents: it.precioUnitarioCents,
      cantidad: it.cantidad,
      subtotal_cents: it.subtotalCents,
    }))
  );
  if (insError) throw new Error(insError.message);
}

export async function getLedgerEntryItems(ledgerEntryId: string): Promise<ContractorLedgerEntryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entry_items")
    .select("*")
    .eq("ledger_entry_id", ledgerEntryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLedgerEntryItem);
}

export async function createLedgerEntry(input: UpsertLedgerEntryInput): Promise<ContractorLedgerEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .insert({ contractor_id: input.contractorId, ...ledgerFields(input) })
    .select("*, projects(name)")
    .single();
  if (error) throw new Error(error.message);
  if (input.items !== undefined) await replaceLedgerEntryItems(data.id, input.items);
  const { projects, ...row } = data as LedgerRow & { projects: { name: string } | null };
  return mapLedger(row, projects?.name ?? null);
}

export async function updateLedgerEntry(
  id: string,
  input: Omit<UpsertLedgerEntryInput, "contractorId">
): Promise<ContractorLedgerEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .update(ledgerFields(input))
    .eq("id", id)
    .select("*, projects(name)")
    .single();
  if (error) throw new Error(error.message);
  if (input.items !== undefined) await replaceLedgerEntryItems(id, input.items);
  const { projects, ...row } = data as LedgerRow & { projects: { name: string } | null };
  return mapLedger(row, projects?.name ?? null);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Tarifas de mano de obra — catálogo de precios (tabla `labor_rates`).
// No se borran registros (trazabilidad histórica): se inactivan con
// `activo = false`.
// ============================================================================

export async function getLaborRates(): Promise<LaborRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labor_rates")
    .select("*")
    .order("contractor_type", { ascending: true })
    .order("orden", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLaborRate);
}

export interface CreateLaborRateInput {
  contractorType: ContractorType;
  /** Obligatoria si `contractorType === 'ebanista'`; se ignora (queda
   *  NULL) para 'pintor'. */
  fase?: LaborRatePhase | null;
  unidad: LaborRateUnit;
  descripcion: string;
  precioCents: number;
  orden?: number;
}

export async function createLaborRate(input: CreateLaborRateInput): Promise<LaborRate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labor_rates")
    .insert({
      contractor_type: input.contractorType,
      fase: input.contractorType === "ebanista" ? (input.fase ?? null) : null,
      unidad: input.unidad,
      descripcion: input.descripcion.trim(),
      precio_cents: input.precioCents,
      orden: input.orden ?? 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapLaborRate(data);
}

export interface UpdateLaborRateInput {
  contractorType?: ContractorType;
  fase?: LaborRatePhase | null;
  unidad?: LaborRateUnit;
  descripcion?: string;
  precioCents?: number;
  activo?: boolean;
  orden?: number;
}

/** Patch parcial. El trigger `labor_rates_touch_updated_at` mantiene
 *  `updated_at`. */
export async function updateLaborRate(id: string, input: UpdateLaborRateInput): Promise<LaborRate> {
  const patch: Database["public"]["Tables"]["labor_rates"]["Update"] = {};
  if (input.contractorType !== undefined) patch.contractor_type = input.contractorType;
  if (input.fase !== undefined) patch.fase = input.fase;
  if (input.unidad !== undefined) patch.unidad = input.unidad;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion.trim();
  if (input.precioCents !== undefined) patch.precio_cents = input.precioCents;
  if (input.activo !== undefined) patch.activo = input.activo;
  if (input.orden !== undefined) patch.orden = input.orden;

  const supabase = await createClient();
  const { data, error } = await supabase.from("labor_rates").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapLaborRate(data);
}

// ── Ayudantes del contratista ──────────────────────────────────────────

function mapHelper(r: HelperRow): ContractorHelper {
  return {
    id: r.id,
    contractorId: r.contractor_id,
    name: r.name,
    idDocument: r.id_document,
    phone: r.phone,
    bankName: r.bank_name,
    bankAccountType: r.bank_account_type === "ahorro" || r.bank_account_type === "corriente" ? r.bank_account_type : null,
    bankAccountNumber: r.bank_account_number,
    notes: r.notes,
  };
}

export async function getContractorHelpers(contractorId: string): Promise<ContractorHelper[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_helpers")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapHelper);
}

export type ContractorHelperInput = Omit<ContractorHelper, "id" | "contractorId">;

function helperColumns(input: ContractorHelperInput) {
  return {
    name: input.name,
    id_document: input.idDocument,
    phone: input.phone,
    bank_name: input.bankName,
    bank_account_type: input.bankAccountType,
    bank_account_number: input.bankAccountNumber,
    notes: input.notes,
  };
}

export async function createContractorHelper(
  contractorId: string,
  input: ContractorHelperInput
): Promise<ContractorHelper> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_helpers")
    .insert({ contractor_id: contractorId, ...helperColumns(input) })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapHelper(data);
}

export async function updateContractorHelper(id: string, input: ContractorHelperInput): Promise<ContractorHelper> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_helpers")
    .update(helperColumns(input))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapHelper(data);
}

export async function deleteContractorHelper(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_helpers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Préstamos y descuentos en cuotas (igual que a empleados). Cada cuota es un
// movimiento `reduce` del estado de cuenta con loan_id, fechado al inicio de
// su quincena (ver lib/contractors/contractor-loans.ts).
// ============================================================================

export interface ContractorLoanInput {
  contractorId: string;
  category: LoanCategory;
  principalCents: number;
  paymentMethod?: LoanPaymentMethod;
  requestDate: string;
  numInstallments: number;
  startPeriod?: { year: number; month: number; half: 1 | 2 };
  installmentAmountsCents?: number[];
  interest?: LoanInterestInput | null;
  notes?: string | null;
}

const LOAN_LABEL: Record<LoanCategory, string> = {
  prestamo: "Préstamo",
  adelanto: "Adelanto",
  herramienta: "Herramienta",
  dano: "Daño",
  indrive: "InDrive",
  otro: "Otro descuento",
  tercero: "Descuento a terceros",
};

export async function createContractorLoan(input: ContractorLoanInput): Promise<void> {
  // Descuento a terceros: por ahora solo para empleados.
  if (input.category === "tercero") throw new Error("El descuento a terceros es solo para empleados");
  if (!(input.principalCents > 0)) throw new Error("El monto debe ser mayor que cero");
  const supabase = await createClient();
  const paymentMethod = input.paymentMethod ?? "cuota_fija";
  const numInstallments = isSingleInstallment(input.category) ? 1 : input.numInstallments;
  const startPeriod = input.startPeriod ?? defaultLoanStartPeriod(input.category, input.requestDate);
  if (!startPeriod) throw new Error("Fecha de solicitud inválida");
  const interestCents = computeLoanInterestCents(input.principalCents, numInstallments, input.interest);
  const schedule = computeLoanSchedule(
    input.principalCents + interestCents,
    numInstallments,
    startPeriod,
    paymentMethod,
    input.installmentAmountsCents
  );

  const { data: loan, error } = await supabase
    .from("contractor_loans")
    .insert({
      contractor_id: input.contractorId,
      category: input.category,
      principal_cents: input.principalCents,
      interest_cents: interestCents,
      interest_mode: interestCents > 0 && input.interest ? input.interest.mode : null,
      interest_rate_pct:
        interestCents > 0 && input.interest && input.interest.mode !== "fixed" ? (input.interest.ratePct ?? null) : null,
      payment_method: paymentMethod,
      num_installments: numInstallments,
      request_date: input.requestDate,
      start_period_year: startPeriod.year,
      start_period_month: startPeriod.month,
      start_period_half: startPeriod.half,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const label = LOAN_LABEL[input.category];
  const { error: e2 } = await supabase.from("contractor_ledger_entries").insert(
    schedule.map((cuota, i) => ({
      contractor_id: input.contractorId,
      loan_id: loan.id,
      entry_date: installmentDate(cuota.period, input.requestDate),
      category: input.category,
      direction: "reduce",
      amount_cents: cuota.amountCents,
      description: numInstallments > 1 ? `${label} · cuota ${i + 1} de ${numInstallments}` : label,
      notes: i === 0 ? (input.notes ?? null) : null,
    }))
  );
  if (e2) {
    // Sin cuotas el préstamo no sirve: se deshace (borra en cascada lo que haya entrado).
    await supabase.from("contractor_loans").delete().eq("id", loan.id);
    throw new Error(e2.message);
  }
}

/** Cancela un préstamo: borra las cuotas que todavía no llegan. Las ya
 *  descontadas quedan. */
export async function cancelContractorLoan(loanId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contractor_ledger_entries")
    .delete()
    .eq("loan_id", loanId)
    .gt("entry_date", todayInPanama());
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("contractor_loans").update({ status: "cancelled" }).eq("id", loanId);
  if (e2) throw new Error(e2.message);
}

/** Borra un préstamo y todas sus cuotas — solo si ninguna se descontó todavía. */
export async function deleteContractorLoan(loanId: string): Promise<void> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contractor_ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", loanId)
    .lte("entry_date", todayInPanama());
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) throw new Error("Ya hay cuotas descontadas: cancélalo en vez de borrarlo.");
  const { error: e2 } = await supabase.from("contractor_loans").delete().eq("id", loanId);
  if (e2) throw new Error(e2.message);
}

/** Cada préstamo con el avance de sus cuotas, a partir de los movimientos ya leídos. */
async function getContractorLoanSummaries(
  rows: { loan_id: string | null; entry_date: string; amount_cents: number }[]
): Promise<ContractorLoanSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contractor_loans").select("*").order("request_date", { ascending: false });
  if (error) throw new Error(error.message);
  const today = todayInPanama();
  const byLoan = new Map<string, { entry_date: string; amount_cents: number }[]>();
  for (const r of rows) {
    if (!r.loan_id) continue;
    const list = byLoan.get(r.loan_id) ?? [];
    list.push(r);
    byLoan.set(r.loan_id, list);
  }
  return (data ?? []).map((l) => {
    const cuotas = (byLoan.get(l.id) ?? []).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const due = cuotas.filter((c) => c.entry_date <= today);
    const pending = cuotas.filter((c) => c.entry_date > today);
    return {
      id: l.id,
      contractorId: l.contractor_id,
      category: l.category as ContractorLoanSummary["category"],
      requestDate: l.request_date,
      principalCents: l.principal_cents,
      interestCents: l.interest_cents,
      status: l.status === "cancelled" ? "cancelled" : "active",
      notes: l.notes,
      installmentCount: cuotas.length,
      dueCount: due.length,
      dueCents: due.reduce((s, c) => s + c.amount_cents, 0),
      pendingCents: pending.reduce((s, c) => s + c.amount_cents, 0),
      next: pending[0] ? { date: pending[0].entry_date, amountCents: pending[0].amount_cents } : null,
    };
  });
}
