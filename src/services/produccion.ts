import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ColorOption,
  HardwareItemOption,
  HardwareLine,
  LaborLine,
  LaborRateOption,
  MaterialLine,
  OrderFile,
  OrderFileKind,
  OrderItem,
  OrderStatus,
  OrderSummary,
  ProductionOrder,
} from "@/types/produccion";
import { DESIGN_ORDER_STATUSES } from "@/types/produccion";

/**
 * Orden de producción · armarla y enviarla a revisión. Permiso Diseño, Proyectos o Contratistas (la RLS lo
 * exige igual). Las reglas de qué se puede editar en cada etapa viven en las acciones.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function getOrder(id: string): Promise<ProductionOrder | null> {
  const supabase = await createClient();
  const { data: o, error } = await supabase.from("production_orders").select("*, projects(name)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!o) return null;
  const [items, files, labor, hardware, materials] = await Promise.all([
    supabase
      .from("production_order_items")
      .select("item_id, color, sort_order, project_items(area, name, kind, sort_order, project_item_files(kind, drive_file_id, name, round, created_at))")
      .eq("order_id", id),
    supabase.from("production_order_files").select("*").eq("order_id", id).order("created_at"),
    supabase.from("production_order_labor").select("*").eq("order_id", id).order("created_at"),
    supabase.from("production_order_hardware").select("*").eq("order_id", id).order("created_at"),
    supabase.from("production_order_materials").select("*").eq("order_id", id).order("created_at"),
  ]);
  for (const r of [items, files, labor, hardware, materials]) if (r.error) throw new Error(r.error.message);

  type ItemJoin = {
    item_id: string;
    color: string | null;
    project_items: {
      area: string;
      name: string;
      kind: string;
      sort_order: number;
      project_item_files: { kind: string; drive_file_id: string; name: string; round: number; created_at: string }[] | null;
    } | null;
  };
  const orderItems: OrderItem[] = ((items.data ?? []) as unknown as ItemJoin[])
    .filter((r) => r.project_items)
    .sort((a, b) => a.project_items!.sort_order - b.project_items!.sort_order)
    .map((r) => {
      const pf = r.project_items!.project_item_files ?? [];
      // La hoja de medidas (todas) y la última presentación aprobada.
      const medidas = pf.filter((f) => f.kind === "medidas");
      const aprobada = pf.filter((f) => f.kind === "aprobada").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        itemId: r.item_id,
        area: r.project_items!.area,
        name: r.project_items!.name,
        kind: r.project_items!.kind,
        color: r.color,
        files: [
          ...medidas.map((f) => ({ driveFileId: f.drive_file_id, name: f.name, kind: "medidas" as const })),
          ...(aprobada ? [{ driveFileId: aprobada.drive_file_id, name: aprobada.name, kind: "aprobada" as const }] : []),
        ],
      };
    });

  return {
    id: o.id,
    projectId: o.project_id,
    projectName: (o.projects as { name: string } | null)?.name ?? "—",
    number: o.number,
    status: o.status as OrderStatus,
    statusSince: o.status_since,
    reviewNote: o.review_note,
    notes: o.notes,
    sentAt: o.sent_at,
    createdAt: o.created_at,
    items: orderItems,
    files: (files.data ?? []).map(
      (f): OrderFile => ({ id: f.id, kind: f.kind as OrderFileKind, driveFileId: f.drive_file_id, name: f.name, mimeType: f.mime_type, sizeBytes: f.size_bytes, createdAt: f.created_at }),
    ),
    labor: (labor.data ?? []).map(
      (l): LaborLine => ({
        id: l.id,
        itemId: l.item_id,
        rateId: l.rate_id,
        contractorType: l.contractor_type,
        fase: l.fase,
        unidad: l.unidad,
        description: l.description,
        quantity: num(l.quantity),
        unitPriceCents: l.unit_price_cents,
      }),
    ),
    hardware: (hardware.data ?? []).map(
      (h): HardwareLine => ({
        id: h.id,
        source: h.source === "especial" ? "especial" : "inventario",
        inventoryItemId: h.inventory_item_id,
        description: h.description,
        quantity: num(h.quantity),
        unit: h.unit,
        notes: h.notes,
      }),
    ),
    materials: (materials.data ?? []).map((m): MaterialLine => ({ id: m.id, material: m.material, quantity: num(m.quantity), unit: m.unit, notes: m.notes })),
  };
}

/** Las órdenes que siguen en Diseño (borrador, en revisión, por corregir), de un proyecto o de todos los activos. */
export async function getOrderSummaries(filter: { projectId?: string; inDesignOnly?: boolean } = {}): Promise<OrderSummary[]> {
  const supabase = await createClient();
  let q = supabase
    .from("production_orders")
    .select("id, project_id, number, status, status_since, projects!inner(name, status), production_order_items(item_id, color), production_order_files(kind), production_order_labor(id)")
    .order("status_since");
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  else q = q.eq("projects.status", "ACTIVE");
  if (filter.inDesignOnly) q = q.in("status", DESIGN_ORDER_STATUSES as OrderStatus[]);
  const [{ data, error }, names] = await Promise.all([q, supabase.rpc("project_designer_names")]);
  if (error) throw new Error(error.message);
  const designers = new Map((names.data ?? []).map((r) => [r.project_id, r.names as string[]]));
  type Row = {
    id: string;
    project_id: string;
    number: number;
    status: string;
    status_since: string;
    projects: { name: string };
    production_order_items: { item_id: string; color: string | null }[];
    production_order_files: { kind: string }[];
    production_order_labor: { id: string }[];
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.projects.name,
    number: r.number,
    status: r.status as OrderStatus,
    statusSince: r.status_since,
    itemIds: r.production_order_items.map((i) => i.item_id),
    fileKinds: r.production_order_files.map((f) => f.kind as OrderFileKind),
    laborCount: r.production_order_labor.length,
    colorsPending: r.production_order_items.filter((i) => !i.color?.trim()).length,
    designers: designers.get(r.project_id) ?? [],
  }));
}

export async function createOrder(projectId: string, itemIds: string[]): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("production_orders").insert({ project_id: projectId }).select("id").single();
  if (error) throw new Error(error.message);
  if (itemIds.length) await addOrderItems(data.id, itemIds);
  return data.id;
}

export async function addOrderItems(orderId: string, itemIds: string[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_items").insert(itemIds.map((item_id, i) => ({ order_id: orderId, item_id, sort_order: i })));
  if (error) throw new Error(error.code === "23505" ? "Uno de los ítems ya está en otra orden." : error.message);
}

export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_items").delete().eq("order_id", orderId).eq("item_id", itemId);
  if (error) throw new Error(error.message);
}

export async function setItemColor(orderId: string, itemId: string, color: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_items").update({ color }).eq("order_id", orderId).eq("item_id", itemId);
  if (error) throw new Error(error.message);
}

export async function setOrderStatus(id: string, status: OrderStatus, reviewNote?: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_orders")
    .update({ status, ...(reviewNote !== undefined ? { review_note: reviewNote } : {}) })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setOrderNotes(id: string, notes: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_orders").update({ notes }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra la orden (y devuelve sus archivos de Drive, para la papelera). Sus ítems quedan libres otra vez. */
export async function deleteOrder(id: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("production_order_files").select("drive_file_id").eq("order_id", id);
  const { error } = await supabase.from("production_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => f.drive_file_id);
}

export async function addOrderFiles(orderId: string, files: { kind: OrderFileKind; driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null }[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_order_files")
    .insert(files.map((f) => ({ order_id: orderId, kind: f.kind, drive_file_id: f.driveFileId, name: f.name, mime_type: f.mimeType, size_bytes: f.sizeBytes })));
  if (error) throw new Error(error.message);
}

export async function removeOrderFile(fileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("production_order_files").select("drive_file_id").eq("id", fileId).maybeSingle();
  const { error } = await supabase.from("production_order_files").delete().eq("id", fileId);
  if (error) throw new Error(error.message);
  return data?.drive_file_id ?? null;
}

export async function addLaborLine(orderId: string, line: Omit<LaborLine, "id">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_labor").insert({
    order_id: orderId,
    item_id: line.itemId,
    rate_id: line.rateId,
    contractor_type: line.contractorType,
    fase: line.fase,
    unidad: line.unidad,
    description: line.description,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
  });
  if (error) throw new Error(error.message);
}

export async function addHardwareLine(orderId: string, line: Omit<HardwareLine, "id">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_hardware").insert({
    order_id: orderId,
    source: line.source,
    inventory_item_id: line.inventoryItemId,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    notes: line.notes,
  });
  if (error) throw new Error(error.message);
}

export async function addMaterialLine(orderId: string, line: Omit<MaterialLine, "id">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_order_materials").insert({ order_id: orderId, material: line.material, quantity: line.quantity, unit: line.unit, notes: line.notes });
  if (error) throw new Error(error.message);
}

export type OrderLineTable = "production_order_labor" | "production_order_hardware" | "production_order_materials";

export async function removeOrderLine(table: OrderLineTable, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** La orden de una línea o un archivo (para validar la etapa antes de tocarlo). */
export async function orderIdOf(table: OrderLineTable | "production_order_files", id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("order_id").eq("id", id).maybeSingle();
  return data?.order_id ?? null;
}

export async function getLaborRateOptions(): Promise<LaborRateOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("labor_rate_options");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, contractorType: r.contractor_type, fase: r.fase, unidad: r.unidad, descripcion: r.descripcion, precioCents: r.precio_cents }));
}

export async function getHardwareItemOptions(): Promise<HardwareItemOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hardware_item_options");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, unit: r.unit, category: r.category }));
}

export async function getColorOptions(projectId: string): Promise<ColorOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("color_options", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ label: r.label, fromProject: r.from_project }));
}
