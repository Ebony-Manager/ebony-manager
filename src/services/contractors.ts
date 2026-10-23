import "server-only";

import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "./photos";
import { selectAllRows } from "@/lib/supabase/select-all";
import type { DashboardContractor, DashboardEntry } from "@/lib/contractors/dashboard";
import { installmentDate, isScheduled, todayInPanama } from "@/lib/contractors/contractor-loans";
import { contractRetentionCents, type RetentionRule } from "@/lib/contractors/contracts";
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
  ContractorAllocation,
  ContractorContract,
  ContractStatus,
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
type ContractRow = Database["public"]["Tables"]["contractor_contracts"]["Row"];
type AllocationRow = Database["public"]["Tables"]["contractor_payment_allocations"]["Row"];

/** `contractor_ledger_entries` ↔ `contractor_contracts` tiene dos caminos
 *  (el FK directo y la tabla de abonos): los embeds llevan el FK explícito. */
const LEDGER_SELECT = "*, projects(name), contractor_contracts!contractor_ledger_entries_contract_id_fkey(name)";
type LedgerJoined = LedgerRow & { projects: { name: string } | null; contractor_contracts: { name: string } | null };

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
  itemsSummary: string | null = null,
  contractName: string | null = null
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
    contractId: r.contract_id,
    contractName,
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
    .select(`${LEDGER_SELECT}, contractor_ledger_entry_items(descripcion, detalle)`)
    .eq("contractor_id", contractorId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const { projects, contractor_contracts, contractor_ledger_entry_items, ...row } = r as unknown as LedgerJoined & {
      contractor_ledger_entry_items: { descripcion: string; detalle: string | null }[];
    };
    return mapLedger(
      row,
      projects?.name ?? null,
      buildItemsSummary(contractor_ledger_entry_items),
      contractor_contracts?.name ?? null
    );
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
  if (error?.code === "23503") throw new Error("Este proyecto tiene contratos: bórralos o muévelos a otro proyecto primero.");
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
  /** Proyecto enganchado (C2). null = sin proyecto. Si viene `contractId`,
   *  manda el proyecto del contrato. */
  projectId?: string | null;
  /** Contrato del que el movimiento es parte del VALOR (trabajo, extra,
   *  bono, ajuste). Si se omite, no se toca. */
  contractId?: string | null;
  /** Solo para lo que baja el saldo (material, gasto…): abonarlo a este
   *  contrato (hasta lo que le falte). */
  allocateToContractId?: string | null;
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
    ...(input.contractId !== undefined ? { contract_id: input.contractId } : {}),
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

/** Con contrato, el proyecto del movimiento es el del contrato. */
async function withContractProject<T extends { contractId?: string | null; projectId?: string | null }>(input: T): Promise<T> {
  if (!input.contractId) return input;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_contracts")
    .select("project_id")
    .eq("id", input.contractId)
    .single();
  if (error) throw new Error(error.message);
  return { ...input, projectId: data.project_id };
}

function mapLedgerJoined(data: unknown): ContractorLedgerEntry {
  const { projects, contractor_contracts, ...row } = data as LedgerJoined;
  return mapLedger(row, projects?.name ?? null, null, contractor_contracts?.name ?? null);
}

export async function createLedgerEntry(input: UpsertLedgerEntryInput): Promise<ContractorLedgerEntry> {
  const full = await withContractProject(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .insert({ contractor_id: full.contractorId, ...ledgerFields(full) })
    .select(LEDGER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (full.items !== undefined) await replaceLedgerEntryItems(data.id, full.items);
  const entry = mapLedgerJoined(data);
  if (full.allocateToContractId) await allocateEntryToContract(entry, full.allocateToContractId);
  return entry;
}

export async function updateLedgerEntry(
  id: string,
  input: Omit<UpsertLedgerEntryInput, "contractorId">
): Promise<ContractorLedgerEntry> {
  const full = await withContractProject(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .update(ledgerFields(full))
    .eq("id", id)
    .select(LEDGER_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (full.items !== undefined) await replaceLedgerEntryItems(id, full.items);
  const entry = mapLedgerJoined(data);
  if (full.allocateToContractId !== undefined) {
    // Se rehace el abono de este movimiento al contrato elegido (o se quita).
    const { error: delErr } = await supabase.from("contractor_payment_allocations").delete().eq("source_entry_id", id);
    if (delErr) throw new Error(delErr.message);
    if (full.allocateToContractId) await allocateEntryToContract(entry, full.allocateToContractId);
  }
  return entry;
}

/** Abona un movimiento que baja el saldo (material, gasto…) a un contrato,
 *  hasta lo que le falte. Lo que no quepa queda a cuenta. */
async function allocateEntryToContract(entry: ContractorLedgerEntry, contractId: string): Promise<void> {
  if (entry.direction !== "reduce" || entry.contractId || entry.ebonyAbsorbsMaterial) return;
  const supabase = await createClient();
  const { data: pending, error } = await supabase.rpc("contractor_contract_pending_cents", { p_contract: contractId });
  if (error) throw new Error(error.message);
  const amount = Math.min(entry.amountCents, Math.max(0, pending ?? 0));
  if (amount <= 0) return;
  const { error: insErr } = await supabase.from("contractor_payment_allocations").insert({
    contractor_id: entry.contractorId,
    source_entry_id: entry.id,
    contract_id: contractId,
    amount_cents: amount,
  });
  if (insErr) throw new Error(insErr.message);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Contratos — un contratista + un proyecto + lo acordado. El valor son sus
// movimientos (`contract_id`); lo abonado, `contractor_payment_allocations`.
// ============================================================================

function mapAllocation(r: AllocationRow): ContractorAllocation {
  return {
    id: r.id,
    sourceEntryId: r.source_entry_id,
    contractId: r.contract_id,
    creditEntryId: r.credit_entry_id,
    amountCents: r.amount_cents,
  };
}

const CONTRACT_SELECT =
  "*, projects!contractor_contracts_project_id_fkey(name, status), contractors!contractor_contracts_contractor_id_fkey(name, contractor_type)";

/** Contratos (de un contratista, o todos) con su valor y lo abonado. */
export async function getContracts(filter: { contractorId?: string } = {}): Promise<ContractorContract[]> {
  const supabase = await createClient();
  let contractsQuery = supabase.from("contractor_contracts").select(CONTRACT_SELECT);
  if (filter.contractorId) contractsQuery = contractsQuery.eq("contractor_id", filter.contractorId);
  const [contractsRes, valueRows, allocRows, settingsRes] = await Promise.all([
    contractsQuery,
    selectAllRows((from, to) => {
      let q = supabase
        .from("contractor_ledger_entries")
        .select("contract_id, category, direction, amount_cents, entry_date, ebony_absorbs_material")
        .not("contract_id", "is", null);
      if (filter.contractorId) q = q.eq("contractor_id", filter.contractorId);
      return q.order("id").range(from, to);
    }),
    selectAllRows((from, to) => {
      let q = supabase
        .from("contractor_payment_allocations")
        .select("contract_id, amount_cents")
        .not("contract_id", "is", null);
      if (filter.contractorId) q = q.eq("contractor_id", filter.contractorId);
      return q.order("id").range(from, to);
    }),
    supabase.from("contractor_type_settings").select("contractor_type, retention_pct, retention_starts_on"),
  ]);
  if (contractsRes.error) throw new Error(contractsRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const rules = new Map<string, RetentionRule>(
    (settingsRes.data ?? []).map((r) => [r.contractor_type, { pct: Number(r.retention_pct), startsOn: r.retention_starts_on }])
  );
  const value = new Map<string, number>();
  const work = new Map<string, Parameters<typeof contractRetentionCents>[0][number][]>();
  for (const r of valueRows) {
    if (!r.contract_id || r.ebony_absorbs_material) continue;
    value.set(r.contract_id, (value.get(r.contract_id) ?? 0) + (r.direction === "a_favor" ? r.amount_cents : -r.amount_cents));
    const list = work.get(r.contract_id) ?? [];
    list.push({
      category: r.category as ContractorLedgerCategory,
      direction: r.direction === "a_favor" ? "a_favor" : "reduce",
      amountCents: r.amount_cents,
      entryDate: r.entry_date,
      ebonyAbsorbsMaterial: r.ebony_absorbs_material,
    });
    work.set(r.contract_id, list);
  }
  const allocated = new Map<string, number>();
  for (const r of allocRows) {
    if (r.contract_id) allocated.set(r.contract_id, (allocated.get(r.contract_id) ?? 0) + r.amount_cents);
  }

  return (contractsRes.data ?? []).map((raw) => {
    const r = raw as unknown as ContractRow & {
      projects: { name: string; status: string } | null;
      contractors: { name: string; contractor_type: string } | null;
    };
    return {
      id: r.id,
      contractorId: r.contractor_id,
      contractorName: r.contractors?.name ?? "—",
      projectId: r.project_id,
      projectName: r.projects?.name ?? "—",
      name: r.name,
      contractDate: r.contract_date,
      status: (r.status === "COMPLETED" ? "COMPLETED" : "ACTIVE") as ContractStatus,
      notes: r.notes,
      valueCents: value.get(r.id) ?? 0,
      allocatedCents: allocated.get(r.id) ?? 0,
      retentionCents: contractRetentionCents(
        work.get(r.id) ?? [],
        rules.get(r.contractors?.contractor_type ?? "") ?? null,
        r.projects?.status === "COMPLETED"
      ),
    };
  });
}

/** Los abonos de un contratista (qué movimiento se abonó a qué). */
export async function getContractorAllocations(contractorId: string): Promise<ContractorAllocation[]> {
  const supabase = await createClient();
  const rows = await selectAllRows((from, to) =>
    supabase
      .from("contractor_payment_allocations")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at")
      .range(from, to)
  );
  return rows.map(mapAllocation);
}

/** Lo que forma el valor de un contrato: sus movimientos (con piezas). */
export async function getContractWork(contractId: string): Promise<ContractorLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .select(`${LEDGER_SELECT}, contractor_ledger_entry_items(descripcion, detalle)`)
    .eq("contract_id", contractId)
    .order("entry_date")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const { projects, contractor_contracts, contractor_ledger_entry_items, ...row } = r as unknown as LedgerJoined & {
      contractor_ledger_entry_items: { descripcion: string; detalle: string | null }[];
    };
    return mapLedger(row, projects?.name ?? null, buildItemsSummary(contractor_ledger_entry_items), contractor_contracts?.name ?? null);
  });
}

export interface ContractHeaderInput {
  projectId: string;
  name: string;
  contractDate: string;
  status?: ContractStatus;
  notes?: string | null;
}

/** El valor del contrato cuando se carga con piezas (o un monto fijo). */
export interface ContractWorkInput {
  amountCents: number;
  mt2?: number | null;
  costPerMt2Cents?: number | null;
  items: LedgerEntryItemInput[];
}

export interface CreateContractInput extends ContractHeaderInput {
  contractorId: string;
  work: ContractWorkInput | null;
  /** Lo que ya se le había abonado antes de registrarlo en la app (el
   *  avance con que arranca). Queda como un ajuste abonado al contrato. */
  prepaidCents?: number;
}

function contractColumns(input: ContractHeaderInput) {
  return {
    project_id: input.projectId,
    name: input.name.trim(),
    contract_date: input.contractDate,
    ...(input.status ? { status: input.status } : {}),
    notes: input.notes ?? null,
  };
}

export async function createContract(input: CreateContractInput): Promise<string> {
  if (!input.name.trim()) throw new Error("El nombre del contrato es obligatorio");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_contracts")
    .insert({ contractor_id: input.contractorId, ...contractColumns(input) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (input.work && input.work.amountCents > 0) {
    try {
      await createLedgerEntry({
        contractorId: input.contractorId,
        contractId: data.id,
        entryDate: input.contractDate,
        category: "trabajo",
        direction: "a_favor",
        amountCents: input.work.amountCents,
        mt2: input.work.mt2 ?? null,
        costPerMt2Cents: input.work.costPerMt2Cents ?? null,
        description: input.name.trim(),
        items: input.work.items,
      });
    } catch (err) {
      await supabase.from("contractor_contracts").delete().eq("id", data.id);
      throw err;
    }
  }
  if (input.prepaidCents && input.prepaidCents > 0) {
    await createLedgerEntry({
      contractorId: input.contractorId,
      entryDate: input.contractDate,
      category: "ajuste",
      direction: "reduce",
      amountCents: input.prepaidCents,
      description: `Abonado antes de la app · ${input.name.trim()}`,
      allocateToContractId: data.id,
    });
  }
  return data.id;
}

/** Corte: deja el saldo del contratista en cero (con un ajuste), reparte
 *  todo lo pendiente y termina sus contratos. Para arrancar "al sol de
 *  hoy": primero el corte, después se crean sus contratos actuales. */
export async function zeroContractorBalance(contractorId: string, date: string, note: string | null): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("zero_contractor_balance", {
    p_contractor_id: contractorId,
    p_date: date,
    p_note: note ?? "",
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

/**
 * Edita el contrato en cualquier momento, aunque ya tenga abonos. Si viene
 * `work`, reemplaza las piezas de `workEntryId` (o crea su movimiento de
 * trabajo si todavía no tiene). Si el valor baja de lo ya abonado, la base
 * recorta los abonos y lo recortado queda a cuenta para el próximo pago.
 */
export async function updateContract(
  id: string,
  input: ContractHeaderInput & { work?: ContractWorkInput | null; workEntryId?: string | null }
): Promise<void> {
  if (!input.name.trim()) throw new Error("El nombre del contrato es obligatorio");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_contracts")
    .update(contractColumns(input))
    .eq("id", id)
    .select("contractor_id")
    .single();
  if (error) throw new Error(error.message);
  // El proyecto de sus movimientos sigue al del contrato.
  const { error: projErr } = await supabase
    .from("contractor_ledger_entries")
    .update({ project_id: input.projectId })
    .eq("contract_id", id);
  if (projErr) throw new Error(projErr.message);

  if (input.work) {
    const fields = {
      contractId: id,
      category: "trabajo" as const,
      direction: "a_favor" as const,
      amountCents: input.work.amountCents,
      mt2: input.work.mt2 ?? null,
      costPerMt2Cents: input.work.costPerMt2Cents ?? null,
      description: input.name.trim(),
      items: input.work.items,
    };
    if (input.workEntryId) {
      if (input.work.amountCents > 0) {
        const { data: current, error: curErr } = await supabase
          .from("contractor_ledger_entries")
          .select("entry_date, notes, client_text")
          .eq("id", input.workEntryId)
          .single();
        if (curErr) throw new Error(curErr.message);
        await updateLedgerEntry(input.workEntryId, {
          ...fields,
          entryDate: current.entry_date,
          notes: current.notes,
          clientText: current.client_text,
        });
      } else {
        await deleteLedgerEntry(input.workEntryId);
      }
    } else if (input.work.amountCents > 0) {
      await createLedgerEntry({ contractorId: data.contractor_id, entryDate: input.contractDate, ...fields });
    }
  }
}

export async function setContractStatus(id: string, status: ContractStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_contracts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra el contrato y su valor (sus movimientos de trabajo). Lo que se le
 *  había abonado queda a cuenta para el próximo pago. */
export async function deleteContract(id: string): Promise<void> {
  const supabase = await createClient();
  const { error: e1 } = await supabase.from("contractor_ledger_entries").delete().eq("contract_id", id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("contractor_contracts").delete().eq("id", id);
  if (e2) throw new Error(e2.message);
}

export interface RegisterPaymentInput {
  contractorId: string;
  date: string;
  lines: { contractId: string; amountCents: number }[];
  /** Abono a lo acreditado sin contrato. */
  looseCents: number;
  notes?: string | null;
}

/** Pago repartido entre contratos: primero se usa lo que está a cuenta
 *  (cuotas, adelantos, material…), el resto sale como un "pago". */
export async function registerContractorPayment(input: RegisterPaymentInput): Promise<{ cashCents: number; deductedCents: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_contractor_payment", {
    p_contractor_id: input.contractorId,
    p_date: input.date,
    p_lines: input.lines.map((l) => ({ contract_id: l.contractId, amount_cents: l.amountCents })),
    p_loose_cents: input.looseCents,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  const out = (data ?? {}) as { cash_cents?: number; deducted_cents?: number };
  return { cashCents: out.cash_cents ?? 0, deductedCents: out.deducted_cents ?? 0 };
}

// ============================================================================
// Cierre quincenal de contratistas: borrador de abonos por contrato →
// marcar pagada (registra todos los pagos en una transacción) → reabrir.
// ============================================================================

export interface ContractorPayPeriod {
  id: string;
  year: number;
  month: number;
  half: 1 | 2;
  payDate: string;
  status: "draft" | "paid";
  paidAt: string | null;
}

export interface ContractorPayLine {
  contractorId: string;
  /** null = abono a lo acreditado sin contrato. */
  contractId: string | null;
  amountCents: number;
}

export interface ContractorPayResult {
  contractorId: string;
  abonosCents: number;
  deductedCents: number;
  cashCents: number;
}

/** Lo mínimo de cada movimiento para calcular lo que está a cuenta y lo
 *  que se debe sin contrato. */
export type ClosingEntry = Pick<
  ContractorLedgerEntry,
  "id" | "contractorId" | "entryDate" | "category" | "direction" | "amountCents" | "contractId" | "ebonyAbsorbsMaterial" | "description" | "loanId"
>;

export interface ContractorClosingData {
  period: ContractorPayPeriod | null;
  payDate: string;
  lines: ContractorPayLine[];
  results: ContractorPayResult[];
  contractors: { id: string; name: string; contractorType: ContractorType; status: ContractorStatus }[];
  contracts: ContractorContract[];
  entries: ClosingEntry[];
  allocations: (ContractorAllocation & { contractorId: string })[];
}

/** Fecha de pago de la quincena: el 15 o el último día del mes. */
export function contractorPayDate(year: number, month: number, half: 1 | 2): string {
  const day = half === 1 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function getContractorClosing(year: number, month: number, half: 1 | 2): Promise<ContractorClosingData> {
  const supabase = await createClient();
  const { data: periodRow, error: pErr } = await supabase
    .from("contractor_pay_periods")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("half", half)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const [contractorsRes, contracts, entryRows, allocRows, linesRes, resultsRes] = await Promise.all([
    supabase.from("contractors").select("id, name, contractor_type, status").order("sort_order").order("name"),
    getContracts(),
    selectAllRows((from, to) =>
      supabase
        .from("contractor_ledger_entries")
        .select("id, contractor_id, entry_date, category, direction, amount_cents, contract_id, ebony_absorbs_material, description, loan_id, created_at")
        .order("entry_date")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    selectAllRows((from, to) =>
      supabase.from("contractor_payment_allocations").select("*").order("id").range(from, to)
    ),
    periodRow
      ? supabase.from("contractor_pay_lines").select("contractor_id, contract_id, amount_cents").eq("period_id", periodRow.id)
      : Promise.resolve({ data: [], error: null }),
    periodRow
      ? supabase.from("contractor_pay_results").select("*").eq("period_id", periodRow.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (contractorsRes.error) throw new Error(contractorsRes.error.message);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (resultsRes.error) throw new Error(resultsRes.error.message);

  return {
    period: periodRow
      ? {
          id: periodRow.id,
          year: periodRow.year,
          month: periodRow.month,
          half: periodRow.half === 2 ? 2 : 1,
          payDate: periodRow.pay_date,
          status: periodRow.status === "paid" ? "paid" : "draft",
          paidAt: periodRow.paid_at,
        }
      : null,
    payDate: periodRow?.pay_date ?? contractorPayDate(year, month, half),
    lines: (linesRes.data ?? []).map((l) => ({ contractorId: l.contractor_id, contractId: l.contract_id, amountCents: l.amount_cents })),
    results: (resultsRes.data ?? []).map((r) => ({
      contractorId: r.contractor_id,
      abonosCents: r.abonos_cents,
      deductedCents: r.deducted_cents,
      cashCents: r.cash_cents,
    })),
    contractors: (contractorsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      contractorType: c.contractor_type === "pintor" ? "pintor" : "ebanista",
      status: c.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })),
    contracts,
    entries: entryRows.map((r) => ({
      id: r.id,
      contractorId: r.contractor_id,
      entryDate: r.entry_date,
      category: r.category as ContractorLedgerCategory,
      direction: r.direction === "a_favor" ? "a_favor" : "reduce",
      amountCents: r.amount_cents,
      contractId: r.contract_id,
      ebonyAbsorbsMaterial: r.ebony_absorbs_material,
      description: r.description,
      loanId: r.loan_id,
    })),
    allocations: allocRows.map((r) => ({ ...mapAllocation(r), contractorId: r.contractor_id })),
  };
}

/** Guarda (o borra, con 0) el abono de un contrato en el borrador de la quincena. */
export async function setContractorPayLine(input: {
  year: number;
  month: number;
  half: 1 | 2;
  contractorId: string;
  contractId: string | null;
  amountCents: number;
}): Promise<void> {
  const supabase = await createClient();
  let { data: period, error } = await supabase
    .from("contractor_pay_periods")
    .select("id, status")
    .eq("year", input.year)
    .eq("month", input.month)
    .eq("half", input.half)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!period) {
    if (input.amountCents <= 0) return;
    ({ data: period, error } = await supabase
      .from("contractor_pay_periods")
      .insert({
        year: input.year,
        month: input.month,
        half: input.half,
        pay_date: contractorPayDate(input.year, input.month, input.half),
      })
      .select("id, status")
      .single());
    if (error || !period) throw new Error(error?.message ?? "No se pudo crear la quincena");
  }
  if (period.status === "paid") throw new Error("Esta quincena ya está pagada: reábrela para cambiarla.");

  let del = supabase.from("contractor_pay_lines").delete().eq("period_id", period.id).eq("contractor_id", input.contractorId);
  del = input.contractId ? del.eq("contract_id", input.contractId) : del.is("contract_id", null);
  const { error: delErr } = await del;
  if (delErr) throw new Error(delErr.message);
  if (input.amountCents <= 0) return;
  const { error: insErr } = await supabase.from("contractor_pay_lines").insert({
    period_id: period.id,
    contractor_id: input.contractorId,
    contract_id: input.contractId,
    amount_cents: input.amountCents,
  });
  if (insErr) throw new Error(insErr.message);
}

export async function closeContractorPayPeriod(periodId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_contractor_pay_period", { p_period: periodId });
  if (error) throw new Error(error.message);
}

export async function reopenContractorPayPeriod(periodId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_contractor_pay_period", { p_period: periodId });
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
