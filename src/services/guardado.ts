import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { IncomingItem, StoredItem, StoredOrigin, StoredPerson, StoredStatus } from "@/types/almacen";

/**
 * Almacén → Apartados: cosas de un solo proyecto guardadas hasta usarlas (un riel especial, la
 * manigueta que trajo el cliente). No son inventario. Ver supabase/migrations/20261127120000_guardado_por_proyecto.sql.
 * Lo ven y registran Almacén, Diseño y Proyectos; el costo, solo Compras y Costos del almacén.
 */

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getStoredItems(projectId?: string): Promise<StoredItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_stored_items_list", { p_project: projectId ?? null });
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    projectItemId: r.project_item_id,
    projectItemName: r.project_item_name,
    description: r.description,
    qty: Number(r.qty),
    unit: r.unit,
    origin: r.origin as StoredOrigin,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    location: r.location,
    photoPath: r.photo_path,
    notes: r.notes,
    receivedOn: r.received_on,
    receivedByName: r.received_by_name,
    status: r.status as StoredStatus,
    deliveredOn: r.delivered_on,
    deliveredToName: r.delivered_to_name,
    deliveredByName: r.delivered_by_name,
    deliveryNotes: r.delivery_notes,
    totalCents: r.total_cents == null ? null : Number(r.total_cents),
  }));
}

export async function getIncomingItems(projectId?: string): Promise<IncomingItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_incoming_items", { p_project: projectId ?? null });
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    description: r.description,
    qty: Number(r.qty),
    unit: r.unit,
    status: r.status as IncomingItem["status"],
    requestedBy: r.requested_by,
    createdAt: r.created_at,
    photoPath: r.photo_path,
    notes: r.notes,
  }));
}

export async function getStoredPeople(): Promise<StoredPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stored_item_people");
  fail(error);
  return (data ?? []).map((p) => ({ kind: p.kind as StoredPerson["kind"], id: p.id, name: p.name, detail: p.detail }));
}

export async function getStoredProjectItems(projectId: string): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stored_item_project_items", { p_project: projectId });
  fail(error);
  return data ?? [];
}

export interface StoredInput {
  projectId: string;
  projectItemId: string | null;
  description: string;
  qty: number;
  unit: string | null;
  location: string | null;
  notes: string | null;
  receivedOn: string;
  supplierId: string | null;
  /** Solo para lo que Ebony compró por su lado. */
  totalCents: number | null;
  /** Al editar algo registrado a mano: cambiarlo entre «ya lo compró Ebony» y «lo trajo el cliente». */
  origin?: "directa" | "cliente";
}

function clean(input: StoredInput) {
  const description = input.description.trim();
  if (!description) throw new Error("Escribe qué es");
  if (!(input.qty > 0)) throw new Error("Pon la cantidad");
  if (!input.projectId) throw new Error("Elige el proyecto");
  return {
    project_id: input.projectId,
    project_item_id: input.projectItemId,
    description,
    qty: input.qty,
    unit: input.unit,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    received_on: input.receivedOn,
  };
}

/** Registrar a mano: lo que trajo el cliente o lo que Ebony ya compró por su lado. Devuelve el id. */
export async function createStoredItem(origin: "directa" | "cliente", input: StoredInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_stored_items")
    .insert({ ...clean(input), origin, supplier_id: origin === "directa" ? input.supplierId : null })
    .select("id")
    .single();
  fail(error);
  if (origin === "directa" && input.totalCents != null) {
    fail((await supabase.rpc("set_stored_item_cost", { p_item: data!.id, p_cents: input.totalCents })).error);
  }
  return data!.id;
}

/** Editar. Lo que vino de Compras no cambia su proyecto, qué es ni la cantidad (eso es de la compra). */
export async function updateStoredItem(id: string, origin: StoredOrigin, input: StoredInput, setCost: boolean): Promise<void> {
  const supabase = await createClient();
  const row = clean(input);
  // Lo registrado a mano puede cambiar de origen; lo que vino de Compras, no.
  const next = origin === "compra" ? "compra" : (input.origin ?? origin);
  // Pasa a «lo trajo el cliente»: ya no tiene costo (se borra mientras todavía es de Ebony).
  if (origin === "directa" && next === "cliente") fail((await supabase.rpc("set_stored_item_cost", { p_item: id, p_cents: null })).error);
  const patch =
    origin === "compra"
      ? { project_item_id: row.project_item_id, location: row.location, notes: row.notes }
      : { ...row, origin: next, supplier_id: next === "directa" ? input.supplierId : null };
  fail((await supabase.from("project_stored_items").update(patch).eq("id", id)).error);
  if (next === "directa" && setCost) fail((await supabase.rpc("set_stored_item_cost", { p_item: id, p_cents: input.totalCents })).error);
}

export async function setStoredItemPhoto(id: string, path: string | null): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("project_stored_items").update({ photo_path: path }).eq("id", id)).error);
}

export interface DeliverInput {
  deliveredOn: string;
  /** Alguien de la lista, o un nombre escrito (ej. "el cliente"). */
  employeeId: string | null;
  contractorId: string | null;
  name: string;
  notes: string | null;
}

export async function deliverStoredItems(ids: string[], input: DeliverInput): Promise<void> {
  if (ids.length === 0) return;
  const name = input.name.trim();
  if (!name) throw new Error("Elige a quién se entregó");
  const supabase = await createClient();
  fail(
    (
      await supabase
        .from("project_stored_items")
        .update({
          status: "entregado",
          delivered_on: input.deliveredOn,
          delivered_to_employee_id: input.employeeId,
          delivered_to_contractor_id: input.contractorId,
          delivered_to_name: name,
          delivery_notes: input.notes?.trim() || null,
        })
        .in("id", ids)
        .eq("status", "en_almacen")
    ).error,
  );
}

/** Deshacer una entrega marcada por error: vuelve a "En almacén". */
export async function undoStoredDelivery(id: string): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("project_stored_items").update({ status: "en_almacen" }).eq("id", id)).error);
}

/** Borrar algo registrado por error (lo que vino de Compras no: se corrige en Compras). Devuelve la foto para borrarla. */
export async function deleteStoredItem(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("project_stored_items").select("photo_path").eq("id", id).maybeSingle();
  fail((await supabase.from("project_stored_items").delete().eq("id", id)).error);
  return data?.photo_path ?? null;
}

/** Dónde quedó guardado lo especial recién recibido (el apartado lo crea la base al recibir la línea). */
export async function setStoredLocationsByLine(rows: { lineId: string; location: string }[]): Promise<void> {
  const supabase = await createClient();
  for (const r of rows) {
    fail((await supabase.from("project_stored_items").update({ location: r.location }).eq("purchase_line_id", r.lineId)).error);
  }
}
