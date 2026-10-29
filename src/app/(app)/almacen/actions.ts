"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule, requireProfile } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import * as almacen from "@/services/almacen";
import type { AdjustmentReason, OrderDelivery, RequestStatus, ToolCondition, ToolStatus } from "@/types/almacen";
import { dispatchPendingPush } from "@/lib/notifications/push";

// Almacén: cada action pide su permiso al entrar (además de la RLS y de los
// chequeos dentro de las funciones de la base). Las solicitudes de compra las
// crea cualquier usuario; Compras las gestiona.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    await dispatchPendingPush().catch(() => undefined);
    revalidatePath("/almacen", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ── Proveedores (Compras) ───────────────────────────────────────────────

export async function createSupplierAction(input: almacen.SupplierInput) {
  await requireAnyModule("almacen_compras", "directorio");
  return run(() => almacen.createSupplier(input));
}

export async function updateSupplierAction(id: string, input: almacen.SupplierInput) {
  await requireAnyModule("almacen_compras", "directorio");
  return run(() => almacen.updateSupplier(id, input));
}

// ── Catálogo (Compras) ──────────────────────────────────────────────────

export async function createItemAction(input: almacen.ItemInput) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.createItem(input));
}

export async function updateItemAction(id: string, input: almacen.ItemInput) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.updateItem(id, input));
}

export async function deleteItemAction(id: string) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.deleteItem(id));
}

export async function setItemPhotoAction(id: string, path: string | null) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.setItemPhoto(id, path));
}

export async function assignItemSupplierAction(itemId: string, supplierId: string, primary: boolean) {
  await requireModule("almacen", "almacen_compras");
  if (!itemId || !supplierId || typeof primary !== "boolean") return { ok: false as const, error: "Selecciona un proveedor." };
  return run(() => almacen.assignItemSupplier(itemId, supplierId, primary));
}

export async function linkSupplierToItemsAction(supplierId: string, itemIds: string[]) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.linkSupplierToItems(supplierId, itemIds));
}

export async function saveItemLevelsAction(itemId: string, levels: almacen.VariantLevels[], notes: string | null) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.saveItemLevels(itemId, levels, notes));
}

// ── Salidas (Almacén) ───────────────────────────────────────────────────

export async function registerIssueAction(input: almacen.IssueInput) {
  await requireModule("almacen");
  return run(() => almacen.registerIssue(input));
}

// ── Solicitudes de compra (cualquiera pide; Compras gestiona) ───────────

export async function createPurchaseRequestAction(input: almacen.RequestInput, rememberSupplier = false) {
  const profile = await requireProfile();
  // Elegir proveedor es de quien ve el Almacén; dejarlo como principal del producto, de Compras.
  const canWarehouse = hasModule(profile, "almacen");
  const canPurchase = hasModule(profile, "almacen_compras");
  const supplierId = canWarehouse ? (input.supplierId ?? null) : null;
  return run(async () => {
    await almacen.createPurchaseRequest({ ...input, supplierId }, profile.id);
    if (rememberSupplier && canPurchase && supplierId && input.itemId) await almacen.linkSupplierToItems(supplierId, [input.itemId]);
  });
}

export async function setRequestsSupplierAction(ids: string[], supplierId: string, rememberForItems: string[]) {
  await requireModule("almacen", "almacen_compras");
  return run(async () => {
    await almacen.setRequestsSupplier(ids, supplierId);
    if (rememberForItems.length) await almacen.linkSupplierToItems(supplierId, rememberForItems);
  });
}

export async function setRequestCostAction(id: string, unitCostCents: number | null) {
  await requireModule("almacen", "almacen_compras");
  if (unitCostCents != null && (!Number.isFinite(unitCostCents) || unitCostCents < 0)) return { ok: false as const, error: "Precio inválido" };
  return run(() => almacen.setRequestCost(id, unitCostCents));
}

/** Cancelar la propia (pendiente) o, con Compras, cambiar cantidad o estado. La RLS decide. */
export async function updatePurchaseRequestAction(id: string, patch: { qty?: number; status?: RequestStatus }) {
  await requireProfile();
  return run(() => almacen.updatePurchaseRequest(id, patch));
}

// ── Pedidos ─────────────────────────────────────────────────────────────

export async function createPurchaseOrderAction(supplierId: string, requestIds: string[], notes: string | null, delivery: OrderDelivery) {
  await requireModule("almacen", "almacen_compras");
  if (delivery !== "entrega" && delivery !== "retiro") return { ok: false as const, error: "Entrega inválida" };
  return run(() => almacen.createPurchaseOrder(supplierId, requestIds, notes, delivery));
}

export async function setOrderDeliveryAction(orderId: string, delivery: OrderDelivery) {
  await requireModule("almacen", "almacen_compras");
  if (delivery !== "entrega" && delivery !== "retiro") return { ok: false as const, error: "Entrega inválida" };
  return run(() => almacen.setOrderDelivery(orderId, delivery));
}

export async function receivePurchaseOrderAction(orderId: string, receivedOn: string | null, lines: { lineId: string; qty: number }[]) {
  await requireModule("almacen");
  return run(() => almacen.receivePurchaseOrder(orderId, receivedOn, lines));
}

export async function saveOrderInvoiceAction(orderId: string, invoiceRef: string | null, costs: { lineId: string; totalCents: number | null }[]) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.saveOrderInvoice(orderId, invoiceRef, costs));
}

export async function cancelPurchaseOrderAction(orderId: string) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.cancelPurchaseOrder(orderId));
}

// ── Ajustes ─────────────────────────────────────────────────────────────

export async function registerAdjustmentAction(
  reason: AdjustmentReason,
  notes: string | null,
  counted: boolean,
  lines: { variantId: string; qty: number }[],
) {
  await requireModule("almacen", "almacen_ajustes");
  return run(() => almacen.registerAdjustment(reason, notes, counted, lines));
}

// ── Herramientas y envases (Etapa 2) ────────────────────────────────────
// Prestar, devolver y marcar envases: el Almacén. Crear o editar
// herramientas: Ajustes de inventario o Compras (la RLS decide igual).

export async function createToolAction(input: almacen.ToolInput) {
  await requireAnyModule("almacen_ajustes", "almacen_compras");
  return run(() => almacen.createTool(input));
}

export async function updateToolAction(id: string, input: almacen.ToolInput, currentStatus: ToolStatus) {
  await requireAnyModule("almacen_ajustes", "almacen_compras");
  return run(() => almacen.updateTool(id, input, currentStatus));
}

export async function setToolPhotoAction(id: string, path: string | null) {
  await requireAnyModule("almacen_ajustes", "almacen_compras");
  return run(() => almacen.setToolPhoto(id, path));
}

export async function lendToolsAction(input: almacen.LendInput) {
  await requireModule("almacen");
  return run(() => almacen.lendTools(input));
}

export async function returnToolAction(loanId: string, condition: ToolCondition, notes: string | null, returnedOn: string | null) {
  await requireModule("almacen");
  return run(() => almacen.returnTool(loanId, condition, notes, returnedOn));
}

export async function getPendingReturnsAction(recipient: { kind: "empleado" | "contratista"; id: string }) {
  await requireModule("almacen");
  return run(() => almacen.getPendingReturns(recipient));
}

export async function returnContainersAction(movementIds: string[]) {
  await requireModule("almacen");
  return run(() => almacen.returnContainers(movementIds));
}
