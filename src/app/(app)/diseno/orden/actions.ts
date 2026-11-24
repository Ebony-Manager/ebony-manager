"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { driveEnabled, ensureSubfolders, getItem as getDriveItem, startUpload, trashItem } from "@/lib/google/drive";
import { orderMissing } from "@/lib/produccion/missing";
import * as diseno from "@/services/diseno";
import * as produccion from "@/services/produccion";
import { EDITABLE_ORDER_STATUSES, ORDER_FILE_KINDS, type HardwareLine, type MaterialLine, type OrderFileKind, type ProductionOrder } from "@/types/produccion";
import { ITEM_FILE_MAX } from "@/types/diseno";
import { ensureProjectFolderAction } from "@/app/(app)/drive-actions";
import { projectPath } from "@/app/(app)/proyectos/paths";
import { orderPath } from "./paths";
import { checkProjectDriveFile } from "../drive-check";

// Orden de producción · armarla y enviarla a revisión. Permiso Diseño, Proyectos o Contratistas (la RLS lo repite).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const access = () => requireAnyModule("diseno", "proyectos", "contratistas");

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

function revalidate(o: { id: string; projectId: string }) {
  revalidatePath("/diseno");
  revalidatePath(projectPath(o.projectId));
  revalidatePath(orderPath(o.id));
}

/** La orden, si todavía se puede editar (borrador o por corregir). */
async function editable(orderId: string): Promise<ProductionOrder> {
  const o = await produccion.getOrder(orderId);
  if (!o) throw new Error("La orden ya no existe.");
  if (!EDITABLE_ORDER_STATUSES.includes(o.status)) throw new Error("La orden está en revisión: retírala de revisión para cambiarla.");
  return o;
}

/** Ítems que pueden entrar: del proyecto, aprobados y que no estén ya en otra orden. */
async function checkItems(projectId: string, itemIds: string[]) {
  const [items, orders] = await Promise.all([diseno.getProjectItems(projectId), produccion.getOrderSummaries({ projectId })]);
  const taken = new Set(orders.flatMap((o) => o.itemIds));
  for (const id of itemIds) {
    const it = items.find((i) => i.id === id);
    if (!it) throw new Error("Uno de los ítems no es de este proyecto.");
    if (it.stage !== "aprobado") throw new Error(`«${it.name}» todavía no está aprobado.`);
    if (taken.has(id)) throw new Error(`«${it.name}» ya está en otra orden.`);
  }
}

export async function createOrderAction(projectId: string, itemIds: string[]): Promise<Result<string>> {
  await access();
  if (itemIds.length === 0) return { ok: false, error: "Escoge al menos un ítem." };
  const res = await run(async () => {
    await checkItems(projectId, itemIds);
    return produccion.createOrder(projectId, itemIds);
  });
  if (res.ok) revalidate({ id: res.data, projectId });
  return res;
}

export async function addOrderItemsAction(orderId: string, itemIds: string[]): Promise<Result> {
  await access();
  const res = await run(async () => {
    const o = await editable(orderId);
    await checkItems(o.projectId, itemIds);
    await produccion.addOrderItems(orderId, itemIds);
    revalidate(o);
    return null;
  });
  return res;
}

export async function removeOrderItemAction(orderId: string, itemId: string): Promise<Result> {
  await access();
  return run(async () => {
    const o = await editable(orderId);
    await produccion.removeOrderItem(orderId, itemId);
    revalidate(o);
    return null;
  });
}

/** El color de un ítem: se puede cambiar también en revisión (no bloquea nada; se exige al autorizar la pintura). */
export async function setItemColorAction(orderId: string, itemId: string, color: string): Promise<Result> {
  await access();
  return run(async () => {
    const o = await produccion.getOrder(orderId);
    if (!o) throw new Error("La orden ya no existe.");
    await produccion.setItemColor(orderId, itemId, color.replace(/\s+/g, " ").trim() || null);
    revalidate(o);
    return null;
  });
}

export async function setOrderNotesAction(orderId: string, notes: string): Promise<Result> {
  await access();
  return run(async () => {
    const o = await editable(orderId);
    await produccion.setOrderNotes(orderId, notes.trim() || null);
    revalidate(o);
    return null;
  });
}

/** Enviar a revisión: solo si no falta nada obligatorio. */
export async function sendOrderAction(orderId: string): Promise<Result> {
  await access();
  return run(async () => {
    const o = await editable(orderId);
    const missing = orderMissing({ itemCount: o.items.length, fileKinds: o.files.map((f) => f.kind), laborCount: o.labor.length });
    if (missing.length) throw new Error("A la orden todavía le falta algo: revisa la lista de arriba.");
    await produccion.setOrderStatus(orderId, "en_revision");
    revalidate(o);
    return null;
  });
}

/** Retirar de revisión para cambiar algo (vuelve a borrador). */
export async function withdrawOrderAction(orderId: string): Promise<Result> {
  await access();
  return run(async () => {
    const o = await produccion.getOrder(orderId);
    if (!o) throw new Error("La orden ya no existe.");
    if (o.status !== "en_revision") throw new Error("La orden no está en revisión.");
    await produccion.setOrderStatus(orderId, "borrador");
    revalidate(o);
    return null;
  });
}

export async function deleteOrderAction(orderId: string): Promise<Result<string>> {
  await access();
  return run(async () => {
    const o = await editable(orderId);
    const files = await produccion.deleteOrder(orderId);
    if (driveEnabled()) await Promise.all(files.map((f) => trashItem(f).catch(() => undefined)));
    revalidate(o);
    return o.projectId;
  });
}

// ── Documentos ──

/** La carpeta de la orden en Drive: proyecto → ORDEN DE PRODUCCION → Orden N. */
async function orderFolder(o: { projectId: string; number: number }): Promise<string> {
  if (!driveEnabled()) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const project = await ensureProjectFolderAction(o.projectId);
  if (!project.ok) throw new Error(project.error);
  const base = (await ensureSubfolders(project.data.folderId, ["ORDEN DE PRODUCCION"])).get("ORDEN DE PRODUCCION")!;
  const name = `ORDEN ${o.number}`;
  return (await ensureSubfolders(base, [name])).get(name)!;
}

export async function startOrderUploadAction(orderId: string, name: string, mimeType: string, size: number): Promise<Result<string>> {
  await access();
  if (size > ITEM_FILE_MAX) return { ok: false, error: `«${name}» pesa más de 200 MB.` };
  const origin = (await headers()).get("origin");
  return run(async () => startUpload(await orderFolder(await editable(orderId)), name, mimeType, size, origin));
}

export type UploadedOrderFile = { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null; kind: OrderFileKind };

export async function addOrderFilesAction(orderId: string, files: UploadedOrderFile[]): Promise<Result> {
  await access();
  return run(async () => {
    const o = await editable(orderId);
    const folder = await orderFolder(o);
    const checked = [];
    for (const f of files) {
      if (!ORDER_FILE_KINDS.includes(f.kind)) throw new Error("Tipo de documento no válido.");
      const item = await getDriveItem(f.driveFileId);
      if (item.parentId !== folder) throw new Error(`«${f.name}» no quedó en la carpeta de la orden.`);
      checked.push({ ...f, name: item.name, mimeType: item.mimeType, sizeBytes: item.size ?? f.sizeBytes });
    }
    await produccion.addOrderFiles(orderId, checked);
    revalidate(o);
    return null;
  });
}

/** Un documento escogido del Drive del proyecto (sin subirlo otra vez): al quitarlo nunca se borra de Drive. */
export async function linkOrderFileAction(orderId: string, kind: OrderFileKind, driveFileId: string): Promise<Result> {
  await access();
  return run(async () => {
    if (!ORDER_FILE_KINDS.includes(kind)) throw new Error("Tipo de documento no válido.");
    const o = await editable(orderId);
    if (o.files.some((f) => f.driveFileId === driveFileId && f.kind === kind)) return null;
    const drive = await checkProjectDriveFile(o.projectId, driveFileId);
    await produccion.addOrderFiles(orderId, [{ kind, driveFileId, name: drive.name, mimeType: drive.mimeType, sizeBytes: drive.size, linked: true }]);
    revalidate(o);
    return null;
  });
}

export async function removeOrderFileAction(fileId: string): Promise<Result> {
  await access();
  return run(async () => {
    const orderId = await produccion.orderIdOf("production_order_files", fileId);
    if (!orderId) throw new Error("El archivo ya no existe.");
    const o = await editable(orderId);
    const driveId = await produccion.removeOrderFile(fileId);
    if (driveId && driveEnabled()) await trashItem(driveId).catch(() => undefined);
    revalidate(o);
    return null;
  });
}

// ── Mano de obra, herrajes y reserva ──

export async function addLaborLineAction(orderId: string, input: { rateId: string; itemId: string | null; quantity: number }): Promise<Result> {
  await access();
  if (!(input.quantity > 0)) return { ok: false, error: "Escribe la cantidad." };
  return run(async () => {
    const o = await editable(orderId);
    const rate = (await produccion.getLaborRateOptions()).find((r) => r.id === input.rateId);
    if (!rate) throw new Error("Esa tarifa ya no está vigente.");
    if (input.itemId && !o.items.some((i) => i.itemId === input.itemId)) throw new Error("Ese ítem no está en la orden.");
    await produccion.addLaborLine(orderId, {
      itemId: input.itemId,
      rateId: rate.id,
      contractorType: rate.contractorType,
      fase: rate.fase,
      unidad: rate.unidad,
      description: rate.descripcion,
      quantity: Math.round(input.quantity * 100) / 100,
      unitPriceCents: rate.precioCents,
    });
    revalidate(o);
    return null;
  });
}

export async function addHardwareLineAction(orderId: string, input: Omit<HardwareLine, "id">): Promise<Result> {
  await access();
  if (!(input.quantity > 0)) return { ok: false, error: "Escribe la cantidad." };
  return run(async () => {
    const o = await editable(orderId);
    let line = { ...input, description: input.description.trim(), notes: input.notes?.trim() || null };
    if (input.source === "inventario") {
      const it = (await produccion.getHardwareItemOptions()).find((h) => h.id === input.inventoryItemId);
      if (!it) throw new Error("Escoge el artículo del inventario.");
      line = { ...line, description: it.name, unit: it.unit };
    } else {
      if (!line.description) throw new Error("Escribe qué herraje hay que comprar.");
      line = { ...line, inventoryItemId: null };
    }
    await produccion.addHardwareLine(orderId, line);
    revalidate(o);
    return null;
  });
}

export async function addMaterialLineAction(orderId: string, input: Omit<MaterialLine, "id">): Promise<Result> {
  await access();
  if (!input.material.trim()) return { ok: false, error: "Escribe el material." };
  if (!(input.quantity > 0)) return { ok: false, error: "Escribe la cantidad." };
  return run(async () => {
    const o = await editable(orderId);
    await produccion.addMaterialLine(orderId, { material: input.material.trim(), quantity: input.quantity, unit: input.unit.trim() || "lámina", notes: input.notes?.trim() || null });
    revalidate(o);
    return null;
  });
}

export async function removeOrderLineAction(table: produccion.OrderLineTable, id: string): Promise<Result> {
  await access();
  if (!["production_order_labor", "production_order_hardware", "production_order_materials"].includes(table)) return { ok: false, error: "No válido." };
  return run(async () => {
    const orderId = await produccion.orderIdOf(table, id);
    if (!orderId) throw new Error("La línea ya no existe.");
    const o = await editable(orderId);
    await produccion.removeOrderLine(table, id);
    revalidate(o);
    return null;
  });
}

// ── Para la ventana flotante de la orden ──

export type OrderBundle = {
  order: ProductionOrder;
  rates: Awaited<ReturnType<typeof produccion.getLaborRateOptions>>;
  hardwareItems: Awaited<ReturnType<typeof produccion.getHardwareItemOptions>>;
  colors: Awaited<ReturnType<typeof produccion.getColorOptions>>;
  freeItems: Awaited<ReturnType<typeof diseno.getProjectItems>>;
};

/** Todo lo que la ventana de la orden necesita: la orden, las tarifas, el inventario, los colores y los ítems libres. */
export async function getOrderBundleAction(orderId: string): Promise<Result<OrderBundle>> {
  await access();
  return run(async () => {
    const order = await produccion.getOrder(orderId);
    if (!order) throw new Error("Esa orden ya no existe.");
    const [rates, hardwareItems, colors, items, orders] = await Promise.all([
      produccion.getLaborRateOptions().catch(() => []),
      produccion.getHardwareItemOptions().catch(() => []),
      produccion.getColorOptions(order.projectId).catch(() => []),
      diseno.getProjectItems(order.projectId).catch(() => []),
      produccion.getOrderSummaries({ projectId: order.projectId }).catch(() => []),
    ]);
    const taken = new Set(orders.flatMap((o) => o.itemIds));
    return { order, rates, hardwareItems, colors, freeItems: items.filter((i) => i.stage === "aprobado" && !taken.has(i.id)) };
  });
}
