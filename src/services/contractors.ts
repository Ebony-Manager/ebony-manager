import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  Contractor,
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorType,
  ContractorWithBalance,
} from "@/types/contractors";
import { contractorBalanceCents } from "@/lib/contractors/contractor-ledger";

/**
 * Capa de datos del módulo Contratistas (tablas `contractors` y
 * `contractor_ledger_entries`, RLS solo-admin). Módulo hermano de
 * Planilla; el saldo del contratista NUNCA se guarda — se computa con
 * `contractorBalanceCents` (`src/lib/contractors/contractor-ledger.ts`).
 *
 * Etapa 1 (C1): alta de contratista, y crear/editar/borrar movimientos
 * del estado de cuenta. Sin inactivar/liquidar/borrar contratista y sin
 * FK a proyectos (el proyecto va como texto libre en `client_text`).
 */

type ContractorRow = Database["public"]["Tables"]["contractors"]["Row"];
type LedgerRow = Database["public"]["Tables"]["contractor_ledger_entries"]["Row"];

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

function mapLedger(r: LedgerRow): ContractorLedgerEntry {
  return {
    id: r.id,
    contractorId: r.contractor_id,
    projectId: r.project_id,
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
 *  fecha de registro) — el mismo orden que espera `withRunningBalance`. */
export async function getContractorLedger(contractorId: string): Promise<ContractorLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_ledger_entries")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLedger);
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

export interface UpsertLedgerEntryInput {
  contractorId: string;
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
    .insert({ contractor_id: input.contractorId, project_id: null, ...ledgerFields(input) })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapLedger(data);
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
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapLedger(data);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contractor_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
