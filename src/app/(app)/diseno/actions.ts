"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { driveEnabled, ensureSubfolders, getItem as getDriveItem, startUpload, trashItem } from "@/lib/google/drive";
import * as diseno from "@/services/diseno";
import { ITEM_FILE_MAX, type ItemEvent, type ItemFileKind, type ItemStage } from "@/types/diseno";
import { ensureProjectFolderAction } from "@/app/(app)/drive-actions";
import { projectPath } from "@/app/(app)/proyectos/paths";

// Diseño · ítems y etapas. Permiso Diseño, Proyectos o Contratistas (la RLS lo repite).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const access = () => requireAnyModule("diseno", "proyectos", "contratistas");

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/** El tablero de Diseño y la ficha del proyecto (una vez, sin refrescar además en la pantalla: ver UI-RULES). */
function revalidate(projectId: string) {
  revalidatePath("/diseno");
  revalidatePath(projectPath(projectId));
}

export async function createItemsAction(projectId: string, items: diseno.ItemInput[]): Promise<Result> {
  await access();
  const clean = items.map((i) => ({ area: i.area.trim(), name: i.name.trim(), kind: i.kind.trim() })).filter((i) => i.name);
  if (clean.length === 0) return { ok: false, error: "Escribe el nombre del ítem." };
  const res = await run(async () => {
    await diseno.createItems(projectId, clean);
    return null;
  });
  if (res.ok) revalidate(projectId);
  return res;
}

export async function updateItemAction(
  id: string,
  projectId: string,
  patch: Partial<diseno.ItemInput> & { areaNotReady?: boolean; nextVisit?: string | null; notes?: string | null },
): Promise<Result> {
  await access();
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Escribe el nombre del ítem." };
  const res = await run(async () => {
    await diseno.updateItem(id, patch);
    return null;
  });
  if (res.ok) revalidate(projectId);
  return res;
}

export async function deleteItemAction(id: string, projectId: string): Promise<Result> {
  await access();
  const res = await run(async () => {
    const files = await diseno.deleteItem(id);
    if (driveEnabled()) await Promise.all(files.map((f) => trashItem(f).catch(() => undefined)));
    return null;
  });
  if (res.ok) revalidate(projectId);
  return res;
}

export async function importQuoteItemsAction(projectId: string): Promise<Result<number>> {
  await access();
  const res = await run(() => diseno.importQuoteItems(projectId));
  if (res.ok) revalidate(projectId);
  return res;
}

export async function getItemEventsAction(id: string): Promise<Result<ItemEvent[]>> {
  await access();
  return run(() => diseno.getItemEvents(id));
}

/** La carpeta de Drive para cada clase de archivo: MEDIDAS (hoja y fotos) o PRESENTACION, dentro del proyecto. */
async function itemFolder(projectId: string, kind: ItemFileKind): Promise<string> {
  if (!driveEnabled()) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const project = await ensureProjectFolderAction(projectId);
  if (!project.ok) throw new Error(project.error);
  const name = kind === "medidas" || kind === "foto" ? "MEDIDAS" : "PRESENTACION";
  return (await ensureSubfolders(project.data.folderId, [name])).get(name)!;
}

/** Abre la subida de un archivo: el navegador lo manda directo a Drive. */
export async function startItemUploadAction(projectId: string, kind: ItemFileKind, name: string, mimeType: string, size: number): Promise<Result<string>> {
  await access();
  if (size > ITEM_FILE_MAX) return { ok: false, error: `«${name}» pesa más de 30 MB.` };
  const origin = (await headers()).get("origin");
  return run(async () => startUpload(await itemFolder(projectId, kind), name, mimeType, size, origin));
}

export type UploadedFile = { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null; kind: ItemFileKind };

/** Comprueba que cada archivo esté de verdad en su carpeta y lo anota en el ítem con la ronda indicada. */
async function registerFiles(itemId: string, projectId: string, files: UploadedFile[], round: number) {
  const checked = [];
  for (const f of files) {
    const folder = await itemFolder(projectId, f.kind);
    const item = await getDriveItem(f.driveFileId);
    if (item.parentId !== folder) throw new Error(`«${f.name}» no quedó en la carpeta del proyecto.`);
    checked.push({ ...f, name: item.name, mimeType: item.mimeType, sizeBytes: item.size ?? f.sizeBytes, round });
  }
  await diseno.addItemFiles(itemId, checked);
}

export type ItemStep = "medido" | "enviar" | "cambios" | "aprobado" | "volver";

/**
 * Mueve un ítem con su acción (y los archivos que la acompañan):
 *  - medido: Por medir → En diseño; pide la hoja de medidas (fotos opcionales).
 *  - enviar: En diseño → Con el cliente; pide la presentación enviada (abre una ronda nueva).
 *  - cambios: Con el cliente → En diseño (el cliente pidió cambios).
 *  - aprobado: Con el cliente → Aprobado; pide la presentación aprobada.
 *  - volver: un paso atrás, para corregir un toque equivocado (sin archivos).
 */
export async function advanceItemAction(id: string, step: ItemStep, files: UploadedFile[]): Promise<Result> {
  await access();
  const item = await diseno.getItem(id);
  if (!item) return { ok: false, error: "El ítem ya no existe." };
  const need = (kind: ItemFileKind, msg: string) => (files.some((f) => f.kind === kind) ? null : msg);
  const plan: Record<ItemStep, { from: ItemStage[]; to: ItemStage; round?: number; error?: string | null }> = {
    medido: { from: ["por_medir"], to: "en_diseno", error: need("medidas", "Sube la hoja de medidas.") },
    enviar: { from: ["en_diseno"], to: "con_cliente", round: item.round + 1, error: need("presentacion", "Sube la presentación que enviaste al cliente.") },
    cambios: { from: ["con_cliente"], to: "en_diseno" },
    aprobado: { from: ["con_cliente"], to: "aprobado", error: need("aprobada", "Sube la presentación que aprobó el cliente.") },
    volver: {
      from: ["en_diseno", "con_cliente", "aprobado"],
      to: item.stage === "aprobado" ? "con_cliente" : item.stage === "con_cliente" ? "en_diseno" : "por_medir",
    },
  };
  const p = plan[step];
  if (!p.from.includes(item.stage)) return { ok: false, error: "El ítem ya cambió de etapa: actualiza la pantalla." };
  if (p.error) return { ok: false, error: p.error };
  const res = await run(async () => {
    await registerFiles(id, item.projectId, files, p.round ?? item.round);
    await diseno.setItemStage(id, p.to, p.round);
    return null;
  });
  if (res.ok) revalidate(item.projectId);
  return res;
}

/** Agrega archivos a un ítem sin cambiar de etapa (otra foto, otra hoja). */
export async function addItemFilesAction(id: string, files: UploadedFile[]): Promise<Result> {
  await access();
  const item = await diseno.getItem(id);
  if (!item) return { ok: false, error: "El ítem ya no existe." };
  const res = await run(async () => {
    await registerFiles(id, item.projectId, files, item.round);
    return null;
  });
  if (res.ok) revalidate(item.projectId);
  return res;
}

export async function removeItemFileAction(fileId: string, projectId: string): Promise<Result> {
  await access();
  const res = await run(async () => {
    const driveId = await diseno.removeItemFile(fileId);
    if (driveId && driveEnabled()) await trashItem(driveId).catch(() => undefined);
    return null;
  });
  if (res.ok) revalidate(projectId);
  return res;
}
