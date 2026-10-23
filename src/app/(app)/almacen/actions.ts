"use server";

import { revalidatePath } from "next/cache";

import { requireModule, requireProfile } from "@/lib/auth/dal";
import * as almacen from "@/services/almacen";
import type { AdjustmentReason, RequestStatus } from "@/types/almacen";

// Almacén: cada action pide su permiso al entrar (además de la RLS y de los
// chequeos dentro de las funciones de la base). Las solicitudes de compra las
// crea cualquier usuario; Compras las gestiona.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/almacen", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ── Proveedores (Compras) ───────────────────────────────────────────────

export async function createSupplierAction(input: almacen.SupplierInput) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.createSupplier(input));
}

export async function updateSupplierAction(id: string, input: almacen.SupplierInput) {
  await requireModule("almacen", "almacen_compras");
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

// ── Salidas (Almacén) ───────────────────────────────────────────────────

export async function registerIssueAction(input: almacen.IssueInput) {
  await requireModule("almacen");
  return run(() => almacen.registerIssue(input));
}

// ── Solicitudes de compra (cualquiera pide; Compras gestiona) ───────────

export async function createPurchaseRequestAction(input: almacen.RequestInput) {
  const profile = await requireProfile();
  return run(() => almacen.createPurchaseRequest(input, profile.id));
}

/** Cancelar la propia (pendiente) o, con Compras, cambiar cantidad o estado. La RLS decide. */
export async function updatePurchaseRequestAction(id: string, patch: { qty?: number; status?: RequestStatus }) {
  await requireProfile();
  return run(() => almacen.updatePurchaseRequest(id, patch));
}

// ── Pedidos ─────────────────────────────────────────────────────────────

export async function createPurchaseOrderAction(supplierId: string, requestIds: string[], notes: string | null) {
  await requireModule("almacen", "almacen_compras");
  return run(() => almacen.createPurchaseOrder(supplierId, requestIds, notes));
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
