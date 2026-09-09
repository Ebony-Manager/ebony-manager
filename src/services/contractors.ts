import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  Contractor,
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorStatus,
  ContractorType,
  ContractorWithBalance,
  Project,
  ProjectStatus,
} from "@/types/contractors";
import { contractorBalanceCents } from "@/lib/contractors/contractor-ledger";

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
    phone: r.phone,
    contactInfo: r.contact_info,
    startDate: r.start_date,
    status: r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    endDate: r.end_date,
    notes: r.notes,
    sortOrder: r.sort_order,
  };
}

function mapLedger(r: LedgerRow, projectName: string | null = null): ContractorLedgerEntry {
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
  };
}

function mapProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    clientName: r.client_name,
    status: r.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
    notes: r.notes,
  };
}

/** Directorio: contratistas (activos primero) + su saldo actual. Dos
 *  queries (contratistas + resumen de movimientos), el saldo se computa
 *  en memoria. */
export async function getContractorsWithBalance(): Promise<ContractorWithBalance[]> {
  const supabase = await createClient();
  const [contractorsRes, ledgerRes] = await Promise.all([
    supabase
      .from("contractors")
      .select("*")
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("contractor_ledger_entries")
      .select("contractor_id, direction, amount_cents, ebony_absorbs_material"),
  ]);
  if (contractorsRes.error) throw new Error(contractorsRes.error.message);
  if (ledgerRes.error) throw new Error(ledgerRes.error.message);

  const byContractor = new Map<
    string,
    { direction: ContractorLedgerDirection; amountCents: number; ebonyAbsorbsMaterial: boolean }[]
  >();
  for (const l of ledgerRes.data ?? []) {
    const list = byContractor.get(l.contractor_id) ?? [];
    list.push({
      direction: l.direction === "a_favor" ? "a_favor" : "reduce",
      amountCents: l.amount_cents,
      ebonyAbsorbsMaterial: l.ebony_absorbs_material,
    });
    byContractor.set(l.contractor_id, list);
  }

  return (contractorsRes.data ?? []).map((r) => ({
    ...mapContractor(r),
    balanceCents: contractorBalanceCents(byContractor.get(r.id) ?? []),
  }));
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
    .select("*, projects(name)")
    .eq("contractor_id", contractorId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const { projects, ...row } = r as LedgerRow & { projects: { name: string } | null };
    return mapLedger(row, projects?.name ?? null);
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

export interface CreateProjectInput {
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
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProject(data);
}

export interface UpdateProjectInput {
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

export interface CreateContractorInput {
  name: string;
  contractorType: ContractorType;
  idDocument?: string | null;
  phone?: string | null;
  contactInfo?: string | null;
  startDate?: string | null;
}

export async function createContractor(input: CreateContractorInput): Promise<Contractor> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .insert({
      name: input.name,
      contractor_type: input.contractorType,
      id_document: input.idDocument ?? null,
      phone: input.phone ?? null,
      contact_info: input.contactInfo ?? null,
      start_date: input.startDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapContractor(data);
}

export interface UpdateContractorInput {
  name?: string;
  contractorType?: ContractorType;
  idDocument?: string | null;
  phone?: string | null;
  contactInfo?: string | null;
  startDate?: string | null;
  /** Salida del contratista: INACTIVE + `endDate` + `notes` documentan el
   *  cierre. La historia y el saldo NUNCA se borran por esto. */
  status?: ContractorStatus;
  endDate?: string | null;
  notes?: string | null;
}

/** Patch parcial (una key `undefined` se deja como está). El trigger
 *  `contractors_touch_updated_at` mantiene `updated_at`. */
export async function updateContractor(id: string, input: UpdateContractorInput): Promise<Contractor> {
  const patch: Database["public"]["Tables"]["contractors"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.contractorType !== undefined) patch.contractor_type = input.contractorType;
  if (input.idDocument !== undefined) patch.id_document = input.idDocument;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.contactInfo !== undefined) patch.contact_info = input.contactInfo;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
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

export async function createLedgerEntry(input: UpsertLedgerEntryInput): Promise<ContractorLedgerEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .insert({ contractor_id: input.contractorId, ...ledgerFields(input) })
    .select("*, projects(name)")
    .single();
  if (error) throw new Error(error.message);
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
  const { projects, ...row } = data as LedgerRow & { projects: { name: string } | null };
  return mapLedger(row, projects?.name ?? null);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
