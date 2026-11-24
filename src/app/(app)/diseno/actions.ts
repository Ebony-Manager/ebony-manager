"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { driveEnabled, ensureSubfolders, getItem as getDriveItem, startUpload, trashItem } from "@/lib/google/drive";
import * as diseno from "@/services/diseno";
import { ITEM_FILE_MAX, type ItemEvent, type ItemFileKind, type ItemStage } from "@/types/diseno";
import { tidyCase } from "@/lib/diseno/text";
import { STEP_FILE, STEP_FROM, STEP_TO, fileRound, hasStepFile, type FileStep } from "@/lib/diseno/steps";
import { ensureProjectFolderAction } from "@/app/(app)/drive-actions";
import { checkProjectDriveFile } from "./drive-check";
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
  const clean = items.map((i) => ({ area: tidyCase(i.area), name: tidyCase(i.name), kind: tidyCase(i.kind), designerId: i.designerId ?? null })).filter((i) => i.name);
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
  patch: Partial<diseno.ItemInput> & { waitingClient?: boolean; areaNotReady?: boolean; nextVisit?: string | null; notes?: string | null },
): Promise<Result> {
  await access();
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Escribe el nombre del ítem." };
  for (const k of ["area", "name", "kind"] as const) if (patch[k] !== undefined) patch = { ...patch, [k]: tidyCase(patch[k]) };
  if (patch.notes !== undefined) patch = { ...patch, notes: patch.notes?.trim() || null };
  const res = await run(async () => {
    await diseno.updateItem(id, patch);
    return null;
  });
  if (res.ok) revalidate(projectId);
  return res;
}

/** Asigna la diseñadora a uno o varios ítems del proyecto (un ítem o un área entera); null = sin asignar. */
export async function assignItemsAction(ids: string[], projectId: string, designerId: string | null): Promise<Result> {
  await access();
  const res = await run(async () => {
    await diseno.assignItems(ids, designerId);
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
  if (size > ITEM_FILE_MAX) return { ok: false, error: `«${name}» pesa más de 200 MB.` };
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

export type ItemStep = "medido" | "aprobado" | "volver";

/** Los ítems pedidos, todos del mismo proyecto. */
async function sameProjectItems(ids: string[]) {
  const items = (await Promise.all([...new Set(ids)].map((id) => diseno.getItem(id)))).filter((i) => i !== null);
  if (items.length === 0) throw new Error("Los ítems ya no existen.");
  if (items.length !== new Set(ids).size) throw new Error("Uno de los ítems ya no existe: actualiza la pantalla.");
  if (new Set(items.map((i) => i.projectId)).size > 1) throw new Error("Los ítems tienen que ser del mismo proyecto.");
  return items;
}

/**
 * Sube el documento de la etapa (hoja de medidas, presentación o presentación aprobada) a uno o varios ítems del
 * mismo proyecto que están en esa etapa: el archivo queda una vez en Drive y anotado en cada ítem.
 */
export async function attachStepFileAction(itemIds: string[], step: FileStep, file: UploadedFile): Promise<Result> {
  await access();
  const res = await run(async () => {
    const items = await sameProjectItems(itemIds);
    const kind = STEP_FILE[step];
    if (file.kind !== kind) throw new Error("Tipo de documento no válido.");
    const wrong = items.find((i) => i.stage !== STEP_FROM[step]);
    if (wrong) throw new Error(`«${wrong.name}» ya cambió de etapa: actualiza la pantalla.`);
    const folder = await itemFolder(items[0].projectId, kind);
    const drive = await getDriveItem(file.driveFileId);
    if (drive.parentId !== folder) throw new Error(`«${file.name}» no quedó en la carpeta del proyecto.`);
    for (const it of items) {
      await diseno.addItemFiles(it.id, [{ ...file, name: drive.name, mimeType: drive.mimeType, sizeBytes: drive.size ?? file.sizeBytes, round: fileRound(it) }]);
    }
    return items[0].projectId;
  });
  if (res.ok) revalidate(res.data);
  return res.ok ? { ok: true, data: null } : res;
}

/**
 * Escoge del Drive del proyecto el documento de la etapa (sin subirlo otra vez) para uno o varios ítems: queda
 * anotado como «escogido», así que al quitarlo nunca se borra de Drive.
 */
export async function linkStepFileAction(itemIds: string[], step: FileStep, driveFileId: string): Promise<Result> {
  await access();
  const res = await run(async () => {
    const items = await sameProjectItems(itemIds);
    const wrong = items.find((i) => i.stage !== STEP_FROM[step]);
    if (wrong) throw new Error(`«${wrong.name}» ya cambió de etapa: actualiza la pantalla.`);
    const drive = await checkProjectDriveFile(items[0].projectId, driveFileId);
    for (const it of items) {
      if (it.files.some((f) => f.driveFileId === driveFileId && f.kind === STEP_FILE[step])) continue;
      await diseno.addItemFiles(it.id, [
        { kind: STEP_FILE[step], round: fileRound(it), driveFileId, name: drive.name, mimeType: drive.mimeType, sizeBytes: drive.size, linked: true },
      ]);
    }
    return items[0].projectId;
  });
  if (res.ok) revalidate(res.data);
  return res.ok ? { ok: true, data: null } : res;
}

/**
 * Mueve uno o varios ítems con su acción:
 *  - medido: Por medir → En diseño; pide la hoja de medidas cargada.
 *  - aprobado: En diseño → Aprobado; pide la presentación aprobada (el ida y vuelta con el cliente va por WhatsApp).
 *  - volver: un paso atrás, para corregir un toque equivocado.
 */
export async function advanceItemsAction(itemIds: string[], step: ItemStep): Promise<Result> {
  await access();
  const res = await run(async () => {
    const items = await sameProjectItems(itemIds);
    for (const item of items) {
      const from: ItemStage[] = step === "volver" ? ["en_diseno", "aprobado"] : [STEP_FROM[step]];
      if (!from.includes(item.stage)) throw new Error(`«${item.name}» ya cambió de etapa: actualiza la pantalla.`);
      if (step !== "volver" && !hasStepFile(item, step))
        throw new Error(`A «${item.name}» le falta ${step === "medido" ? "la hoja de medidas" : "la presentación aprobada"}.`);
    }
    for (const item of items) {
      const to: ItemStage = step === "volver" ? (item.stage === "aprobado" ? "en_diseno" : "por_medir") : STEP_TO[step];
      await diseno.setItemStage(item.id, to);
    }
    return items[0].projectId;
  });
  if (res.ok) revalidate(res.data);
  return res.ok ? { ok: true, data: null } : res;
}

/** Un ítem (para «Pidió cambios» y «Volver» desde su ficha). */
export async function advanceItemAction(id: string, step: ItemStep): Promise<Result> {
  return advanceItemsAction([id], step);
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
