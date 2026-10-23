import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type {
  AdjustmentReason,
  InternalUse,
  InventoryAdjustment,
  InventoryCategory,
  InventoryIssue,
  InventoryItem,
  InventoryPerson,
  InventoryUnit,
  ItemKind,
  OrderStatus,
  PurchaseOrder,
  PurchaseRequest,
  RequestStatus,
  Supplier,
  SupplierKind,
} from "@/types/almacen";

/**
 * Capa de datos del Almacén. La existencia nunca se escribe desde acá: las
 * salidas, recepciones y ajustes van por las funciones de la base
 * (`register_inventory_issue`, `receive_purchase_order`,
 * `register_inventory_adjustment`), que escriben el movimiento y mueven la
 * existencia en la misma transacción. Los costos viven aparte y la RLS los
 * esconde a quien no tiene Compras ni Costos del almacén: acá se piden igual
 * y llegan vacíos.
 */

type Tables = Database["public"]["Tables"];
type SupplierRow = Tables["suppliers"]["Row"];
type ItemRow = Tables["inventory_items"]["Row"];
type VariantRow = Tables["inventory_variants"]["Row"];
type RequestRow = Tables["purchase_requests"]["Row"];

const num = (v: number | string | null): number | null => (v == null ? null : Number(v));

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ── Proveedores ─────────────────────────────────────────────────────────

function mapSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as SupplierKind,
    contactName: r.contact_name,
    phone: r.phone,
    whatsapp: r.whatsapp,
    email: r.email,
    address: r.address,
    notes: r.notes,
    active: r.active,
  };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  fail(error);
  return (data ?? []).map(mapSupplier);
}

export type SupplierInput = Omit<Supplier, "id">;

function supplierRow(input: SupplierInput) {
  const clean = (s: string | null) => (s?.trim() ? s.trim() : null);
  return {
    name: input.name.trim(),
    kind: input.kind,
    contact_name: clean(input.contactName),
    phone: clean(input.phone),
    whatsapp: clean(input.whatsapp),
    email: clean(input.email),
    address: clean(input.address),
    notes: clean(input.notes),
    active: input.active,
  };
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").insert(supplierRow(input)).select("*").single();
  fail(error);
  return mapSupplier(data!);
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").update(supplierRow(input)).eq("id", id).select("*").single();
  fail(error);
  return mapSupplier(data!);
}

// ── Catálogo ────────────────────────────────────────────────────────────

export async function getCategories(): Promise<InventoryCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_categories").select("*").order("sort_order");
  fail(error);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order }));
}

/** Productos con sus variantes, proveedores y (si se pueden ver) costos. */
export async function getCatalog(): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const [items, variants, links, costs] = await Promise.all([
    supabase.from("inventory_items").select("*").order("name"),
    supabase.from("inventory_variants").select("*").order("sort_order").order("label"),
    supabase.from("inventory_item_suppliers").select("*"),
    supabase.from("inventory_costs").select("variant_id, unit_cost_cents"),
  ]);
  fail(items.error);
  fail(variants.error);
  // Sin Almacén no se ven los proveedores; sin Compras/Costos, los costos: llegan vacíos.
  const cost = new Map((costs.data ?? []).map((c) => [c.variant_id, Number(c.unit_cost_cents)]));
  const byItem = new Map<string, VariantRow[]>();
  for (const v of variants.data ?? []) byItem.set(v.item_id, [...(byItem.get(v.item_id) ?? []), v]);
  const linksByItem = new Map<string, NonNullable<typeof links.data>>();
  for (const l of links.data ?? []) linksByItem.set(l.item_id, [...(linksByItem.get(l.item_id) ?? []), l]);

  return (items.data ?? []).map((i: ItemRow) => ({
    id: i.id,
    name: i.name,
    categoryId: i.category_id,
    unit: i.unit as InventoryUnit,
    allowsDecimals: i.allows_decimals,
    kind: i.kind as ItemKind,
    notes: i.notes,
    photoPath: i.photo_path,
    active: i.active,
    variants: (byItem.get(i.id) ?? []).map((v) => ({
      id: v.id,
      itemId: v.item_id,
      label: v.label,
      stockQty: Number(v.stock_qty),
      minQty: num(v.min_qty),
      reorderQty: num(v.reorder_qty),
      sortOrder: v.sort_order,
      active: v.active,
      unitCostCents: cost.get(v.id) ?? null,
    })),
    suppliers: (linksByItem.get(i.id) ?? []).map((l) => ({
      supplierId: l.supplier_id,
      isPrimary: l.is_primary,
      packLabel: l.pack_label,
      packQty: num(l.pack_qty),
      supplierRef: l.supplier_ref,
    })),
  }));
}

export interface ItemInput {
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  allowsDecimals: boolean;
  kind: ItemKind;
  notes: string | null;
  active: boolean;
  /** Variantes: con id se actualizan; sin id se crean; las que falten se desactivan. */
  variants: { id?: string; label: string; minQty: number | null; reorderQty: number | null; active: boolean }[];
  suppliers: { supplierId: string; isPrimary: boolean; packLabel: string | null; packQty: number | null }[];
}

function itemRow(input: ItemInput) {
  return {
    name: input.name.trim(),
    category_id: input.categoryId,
    unit: input.unit,
    allows_decimals: input.allowsDecimals,
    kind: input.kind,
    notes: input.notes?.trim() || null,
    active: input.active,
  };
}

async function saveItemChildren(itemId: string, input: ItemInput): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase.from("inventory_variants").select("id").eq("item_id", itemId);
  fail(error);
  const keep = new Set(input.variants.map((v) => v.id).filter(Boolean));
  const variants = input.variants.length ? input.variants : [{ label: "", minQty: null, reorderQty: null, active: true }];
  for (const [i, v] of variants.entries()) {
    const row = { label: v.label.trim(), min_qty: v.minQty, reorder_qty: v.reorderQty, active: v.active, sort_order: i };
    const res = v.id
      ? await supabase.from("inventory_variants").update(row).eq("id", v.id)
      : await supabase.from("inventory_variants").insert({ ...row, item_id: itemId });
    fail(res.error);
  }
  const gone = (existing ?? []).map((v) => v.id).filter((id) => !keep.has(id));
  if (gone.length) fail((await supabase.from("inventory_variants").update({ active: false }).in("id", gone)).error);

  fail((await supabase.from("inventory_item_suppliers").delete().eq("item_id", itemId)).error);
  if (input.suppliers.length) {
    const rows = input.suppliers.map((s) => ({
      item_id: itemId,
      supplier_id: s.supplierId,
      is_primary: s.isPrimary,
      pack_label: s.packLabel?.trim() || null,
      pack_qty: s.packQty,
    }));
    fail((await supabase.from("inventory_item_suppliers").insert(rows)).error);
  }
}

export async function createItem(input: ItemInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_items").insert(itemRow(input)).select("id").single();
  fail(error);
  await saveItemChildren(data!.id, input);
  return data!.id;
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("inventory_items").update(itemRow(input)).eq("id", id)).error);
  await saveItemChildren(id, input);
}

/**
 * Borra un producto con sus variantes, solo si nunca tuvo movimientos ni
 * solicitudes (si los tuvo, se desactiva: así no se pierde el historial).
 * También borra su foto.
 */
export async function deleteItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: variants, error } = await supabase.from("inventory_variants").select("id").eq("item_id", id);
  fail(error);
  const ids = (variants ?? []).map((v) => v.id);
  if (ids.length) {
    const [movs, reqs] = await Promise.all([
      supabase.from("inventory_movements").select("id", { count: "exact", head: true }).in("variant_id", ids),
      supabase.from("purchase_requests").select("id", { count: "exact", head: true }).in("variant_id", ids),
    ]);
    if ((movs.count ?? 0) > 0 || (reqs.count ?? 0) > 0) {
      throw new Error("Este producto ya tiene movimientos o solicitudes: desactívalo en vez de borrarlo.");
    }
  }
  const { data: item } = await supabase.from("inventory_items").select("photo_path").eq("id", id).maybeSingle();
  fail((await supabase.from("inventory_items").delete().eq("id", id)).error);
  if (item?.photo_path) await supabase.storage.from("inventory-photos").remove([item.photo_path]);
}

/** Guarda (o quita) la foto del producto. El archivo ya lo subió el navegador al bucket. */
export async function setItemPhoto(id: string, path: string | null): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("inventory_items").update({ photo_path: path }).eq("id", id)).error);
}

// ── Personal y proyectos (para las salidas) ─────────────────────────────

export async function getInventoryPeople(): Promise<InventoryPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_people");
  fail(error);
  return (data ?? [])
    .map((p) => ({
      kind: p.kind as InventoryPerson["kind"],
      id: p.id,
      name: p.name,
      active: p.active,
      contractorType: p.contractor_type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getWarehouseProjects(): Promise<{ id: string; name: string; active: boolean }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("id, name, status").order("name");
  fail(error);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, active: p.status === "ACTIVE" }));
}

// ── Salidas ─────────────────────────────────────────────────────────────

export async function getIssues(limit = 200): Promise<InventoryIssue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_issues")
    .select("*, inventory_movements(variant_id, qty, stock_after)")
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    issuedOn: r.issued_on,
    employeeId: r.recipient_employee_id,
    contractorId: r.recipient_contractor_id,
    projectId: r.project_id,
    internalUse: r.internal_use as InternalUse | null,
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    lines: (r.inventory_movements ?? []).map((m) => ({ variantId: m.variant_id, qty: -Number(m.qty), stockAfter: Number(m.stock_after) })),
  }));
}

export interface IssueInput {
  issuedOn: string | null;
  recipient: { kind: "empleado" | "contratista"; id: string };
  projectId: string | null;
  internalUse: InternalUse | null;
  notes: string | null;
  lines: { variantId: string; qty: number }[];
}

export async function registerIssue(input: IssueInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_inventory_issue", {
    p_issued_on: input.issuedOn,
    p_employee_id: input.recipient.kind === "empleado" ? input.recipient.id : null,
    p_contractor_id: input.recipient.kind === "contratista" ? input.recipient.id : null,
    p_project_id: input.projectId,
    p_internal_use: input.internalUse,
    p_notes: input.notes,
    p_lines: input.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })) as Json,
  });
  fail(error);
  return data as string;
}

// ── Solicitudes de compra ───────────────────────────────────────────────

function mapRequest(r: RequestRow): PurchaseRequest {
  return {
    id: r.id,
    variantId: r.variant_id,
    description: r.description,
    qty: Number(r.qty),
    unit: r.unit,
    projectId: r.project_id,
    reason: r.reason,
    status: r.status as RequestStatus,
    auto: r.auto,
    orderLineId: r.order_line_id,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

/** Compras ve todas; el resto, las suyas (RLS). */
export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }).limit(500);
  fail(error);
  return (data ?? []).map(mapRequest);
}

export interface RequestInput {
  variantId: string | null;
  description: string;
  qty: number;
  unit: string | null;
  projectId: string | null;
  reason: string | null;
}

export async function createPurchaseRequest(input: RequestInput, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_requests").insert({
    variant_id: input.variantId,
    description: input.description.trim(),
    qty: input.qty,
    unit: input.unit,
    project_id: input.projectId,
    reason: input.reason?.trim() || null,
    created_by: userId,
  });
  fail(error);
}

export async function updatePurchaseRequest(id: string, patch: { qty?: number; status?: RequestStatus }): Promise<void> {
  const supabase = await createClient();
  fail((await supabase.from("purchase_requests").update(patch).eq("id", id)).error);
}

// ── Pedidos ─────────────────────────────────────────────────────────────

export async function getPurchaseOrders(limit = 100): Promise<PurchaseOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, purchase_order_lines(*)")
    .order("ordered_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  const lineIds = (data ?? []).flatMap((o) => (o.purchase_order_lines ?? []).map((l) => l.id));
  const costs = lineIds.length
    ? ((await supabase.from("purchase_order_line_costs").select("line_id, total_cents").in("line_id", lineIds)).data ?? [])
    : [];
  const cost = new Map(costs.map((c) => [c.line_id, Number(c.total_cents)]));
  return (data ?? []).map((o) => ({
    id: o.id,
    supplierId: o.supplier_id,
    status: o.status as OrderStatus,
    orderedOn: o.ordered_on,
    invoiceRef: o.invoice_ref,
    notes: o.notes,
    createdByName: o.created_by_name,
    createdAt: o.created_at,
    lines: (o.purchase_order_lines ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        variantId: l.variant_id,
        description: l.description,
        qty: Number(l.qty),
        receivedQty: Number(l.received_qty),
        unit: l.unit,
        totalCents: cost.get(l.id) ?? null,
      })),
  }));
}

export async function createPurchaseOrder(supplierId: string, requestIds: string[], notes: string | null): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", { p_supplier_id: supplierId, p_request_ids: requestIds, p_notes: notes });
  fail(error);
  return data as string;
}

export async function receivePurchaseOrder(orderId: string, receivedOn: string | null, lines: { lineId: string; qty: number }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_order_id: orderId,
    p_received_on: receivedOn,
    p_lines: lines.map((l) => ({ line_id: l.lineId, qty: l.qty })) as Json,
  });
  fail(error);
}

/** Factura: número y costo total por línea. */
export async function saveOrderInvoice(orderId: string, invoiceRef: string | null, costs: { lineId: string; totalCents: number | null }[]) {
  const supabase = await createClient();
  fail((await supabase.from("purchase_orders").update({ invoice_ref: invoiceRef?.trim() || null }).eq("id", orderId)).error);
  const set = costs.filter((c) => c.totalCents != null).map((c) => ({ line_id: c.lineId, total_cents: c.totalCents! }));
  if (set.length) fail((await supabase.from("purchase_order_line_costs").upsert(set)).error);
  const cleared = costs.filter((c) => c.totalCents == null).map((c) => c.lineId);
  if (cleared.length) fail((await supabase.from("purchase_order_line_costs").delete().in("line_id", cleared)).error);
}

/** Cancelar un pedido sin nada recibido: sus solicitudes vuelven a pendientes. */
export async function cancelPurchaseOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { data: lines, error } = await supabase.from("purchase_order_lines").select("id, received_qty").eq("order_id", orderId);
  fail(error);
  if ((lines ?? []).some((l) => Number(l.received_qty) > 0)) throw new Error("Ya se recibió algo de este pedido: no se puede cancelar.");
  const ids = (lines ?? []).map((l) => l.id);
  if (ids.length)
    fail((await supabase.from("purchase_requests").update({ status: "pendiente", order_line_id: null }).in("order_line_id", ids)).error);
  fail((await supabase.from("purchase_orders").update({ status: "cancelado" }).eq("id", orderId)).error);
}

// ── Ajustes ─────────────────────────────────────────────────────────────

export async function getAdjustments(limit = 100): Promise<InventoryAdjustment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_adjustments")
    .select("*, inventory_movements(variant_id, qty, stock_after)")
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    adjustedOn: r.adjusted_on,
    reason: r.reason as AdjustmentReason,
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    lines: (r.inventory_movements ?? []).map((m) => ({ variantId: m.variant_id, qty: Number(m.qty), stockAfter: Number(m.stock_after) })),
  }));
}

export async function registerAdjustment(reason: AdjustmentReason, notes: string | null, counted: boolean, lines: { variantId: string; qty: number }[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_inventory_adjustment", {
    p_reason: reason,
    p_notes: notes,
    p_counted: counted,
    p_lines: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })) as Json,
  });
  fail(error);
  return data as string;
}
