import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Client, ClientKind, LinkedQuote, LostReason, Opportunity, OpportunityNote, SalesPerson, Stage } from "@/types/ventas";

/**
 * Capa de datos de Ventas: Clientes y Seguimiento de cotizaciones. Todo pide
 * el permiso Cotización (lo repite la RLS). La etapa, las fechas de envío y
 * cierre y el nombre del responsable los pone la base (trigger); aprobar
 * crea el proyecto con approve_opportunity.
 */

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type OppRow = Database["public"]["Tables"]["sales_opportunities"]["Row"];

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}
const num = (v: number | string | null): number | null => (v == null ? null : Number(v));

function mapClient(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as ClientKind,
    phone: r.phone,
    whatsapp: r.whatsapp,
    email: r.email,
    company: r.company,
    notes: r.notes,
    active: r.active,
  };
}

function mapOpp(r: OppRow, quotes: LinkedQuote[]): Opportunity {
  return {
    id: r.id,
    title: r.title,
    designerId: r.designer_id,
    clientId: r.client_id,
    location: r.location,
    stage: r.stage as Stage,
    lostReason: r.lost_reason as LostReason | null,
    lostNote: r.lost_note,
    receivedOn: r.received_on,
    dueOn: r.due_on,
    nextFollowUp: r.next_follow_up,
    stageChangedAt: r.stage_changed_at,
    sentOn: r.sent_on,
    closedOn: r.closed_on,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    amount: num(r.amount),
    projectId: r.project_id,
    driveFolderId: r.drive_folder_id,
    driveFolderUrl: r.drive_folder_url,
    notes: r.notes,
    createdAt: r.created_at,
    quotes,
  };
}

// ── Clientes ────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").order("name");
  fail(error);
  return (data ?? []).map(mapClient);
}

export interface ClientInput {
  name: string;
  kind: ClientKind;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  active: boolean;
}

function clientRow(i: ClientInput) {
  const t = (v: string | null) => v?.trim() || null;
  return { name: i.name.trim(), kind: i.kind, phone: t(i.phone), whatsapp: t(i.whatsapp), email: t(i.email), company: t(i.company), notes: t(i.notes), active: i.active };
}

export async function createClientRecord(input: ClientInput): Promise<Client> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(clientRow(input)).select("*").single();
  fail(error);
  return mapClient(data!);
}

export async function updateClientRecord(id: string, input: ClientInput): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("clients").update(clientRow(input)).eq("id", id)).error);
}

// ── Oportunidades ───────────────────────────────────────────────────────

export async function getOpportunities(): Promise<Opportunity[]> {
  const supabase = await createClient();
  const [opps, quotes] = await Promise.all([
    supabase.from("sales_opportunities").select("*").order("stage_changed_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, number, quote_date, status, total, updated_at, opportunity_id")
      .not("opportunity_id", "is", null)
      .order("quote_date", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);
  fail(opps.error);
  fail(quotes.error);
  const byOpp = new Map<string, LinkedQuote[]>();
  for (const q of quotes.data ?? []) {
    const list = byOpp.get(q.opportunity_id!) ?? [];
    list.push({ id: q.id, number: q.number, quoteDate: q.quote_date, status: q.status, total: Number(q.total), updatedAt: q.updated_at });
    byOpp.set(q.opportunity_id!, list);
  }
  return (opps.data ?? []).map((r) => mapOpp(r, byOpp.get(r.id) ?? []));
}

export interface OpportunityInput {
  title: string;
  designerId: string | null;
  clientId: string | null;
  location: string | null;
  stage: Stage;
  lostReason: LostReason | null;
  lostNote: string | null;
  receivedOn: string;
  dueOn: string | null;
  nextFollowUp: string | null;
  ownerId: string | null;
  amount: number | null;
  driveFolderUrl: string | null;
  notes: string | null;
}

function oppRow(i: OpportunityInput) {
  const t = (v: string | null) => v?.trim() || null;
  return {
    title: i.title.trim(),
    designer_id: i.designerId,
    client_id: i.clientId,
    location: t(i.location),
    stage: i.stage,
    lost_reason: i.stage === "perdida" ? i.lostReason : null,
    lost_note: i.stage === "perdida" ? t(i.lostNote) : null,
    received_on: i.receivedOn,
    due_on: i.dueOn || null,
    next_follow_up: i.nextFollowUp || null,
    owner_id: i.ownerId,
    amount: i.amount,
    drive_folder_url: t(i.driveFolderUrl),
    notes: t(i.notes),
  };
}

export async function createOpportunity(input: OpportunityInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_opportunities").insert(oppRow(input)).select("id").single();
  fail(error);
  return data!.id;
}

export async function updateOpportunity(id: string, input: OpportunityInput): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("sales_opportunities").update(oppRow(input)).eq("id", id)).error);
}

/** Mover de etapa (desde el tablero); perdida pide motivo. */
export async function setOpportunityStage(id: string, stage: Stage, lostReason: LostReason | null, lostNote: string | null): Promise<void> {
  const supabase = await createClient();
  const patch = stage === "perdida" ? { stage, lost_reason: lostReason, lost_note: lostNote?.trim() || null } : { stage };
  fail((await supabase.from("sales_opportunities").update(patch).eq("id", id)).error);
}

/** Aprobar: crea el proyecto (o enlaza uno existente) con el arquitecto y el cliente. */
export async function approveOpportunity(id: string, projectName: string | null, projectId: string | null): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_opportunity", { p_id: id, p_project_name: projectName, p_project_id: projectId });
  fail(error);
  return data as string;
}

export async function deleteOpportunity(id: string): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("sales_opportunities").delete().eq("id", id)).error);
}

export async function getOpportunityNotes(id: string): Promise<OpportunityNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_opportunity_notes")
    .select("*")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((n) => ({ id: n.id, opportunityId: n.opportunity_id, body: n.body, createdByName: n.created_by_name, createdAt: n.created_at }));
}

export async function addOpportunityNote(id: string, body: string): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("sales_opportunity_notes").insert({ opportunity_id: id, body: body.trim() })).error);
}

export async function getSalesPeople(): Promise<SalesPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_people");
  fail(error);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }));
}

/** Proyectos para enlazar al aprobar (y para la ficha del cliente). */
export async function getSalesProjects(): Promise<{ id: string; name: string; status: string; designerId: string | null; clientId: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("id, name, status, designer_id, client_id").order("name");
  // Sin permiso de Proyectos la lista llega vacía: aprobar igual crea el proyecto.
  if (error) return [];
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status, designerId: p.designer_id, clientId: p.client_id }));
}

/** Para abrir el cotizador desde una oportunidad: cliente, arquitecto y proyecto ya llenos. */
export async function getOpportunityPrefill(id: string): Promise<{ id: string; clientName: string; designerName: string; projectName: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_opportunities").select("id, title, location, designer_id, client_id").eq("id", id).maybeSingle();
  if (!data) return null;
  const ids = [data.designer_id, data.client_id].filter((v): v is string => !!v);
  const { data: people } = ids.length ? await supabase.from("clients").select("id, name").in("id", ids) : { data: [] };
  const name = (cid: string | null) => (cid ? (people ?? []).find((p) => p.id === cid)?.name ?? "" : "");
  return {
    id: data.id,
    clientName: name(data.client_id) || name(data.designer_id),
    designerName: data.client_id ? name(data.designer_id) : "",
    projectName: [data.title, data.location].filter(Boolean).join(" · "),
  };
}
