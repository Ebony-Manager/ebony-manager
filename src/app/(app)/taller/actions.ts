"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import { driveEnabled, driveRoot, ensureSubfolders, getItem, startUpload, trashItem } from "@/lib/google/drive";
import { dispatchPendingPush } from "@/lib/notifications/push";
import * as taller from "@/services/taller";
import { WORK_ORDER_FILE_MAX, WORK_ORDER_STATUSES, type WorkOrderEvent, type WorkOrderStatus } from "@/types/taller";
import { projectPath } from "@/app/(app)/proyectos/paths";

// Taller · Trabajos (por ahora CNC). Ver TALLER-PLAN.md. Todo pide el permiso `taller` (la RLS lo repite).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/** La pantalla de Taller y, si aplica, la ficha del proyecto (sin refrescar en la pantalla además: ver UI-RULES). */
function revalidate(projectIds: (string | null | undefined)[] = []) {
  revalidatePath("/taller");
  for (const id of new Set(projectIds)) if (id) revalidatePath(projectPath(id));
}

/** Manda los avisos al teléfono que dejó la base (asignado / listo). Si falla, el aviso queda en la campana igual. */
async function pushNow() {
  await dispatchPendingPush().catch(() => undefined);
}

export async function getWorkOrderEventsAction(id: string): Promise<Result<WorkOrderEvent[]>> {
  await requireModule("taller");
  return run(() => taller.getWorkOrderEvents(id));
}

export async function saveWorkOrderAction(
  id: string | null,
  input: taller.WorkOrderInput,
  previousProjectId?: string | null,
): Promise<Result<string>> {
  await requireModule("taller");
  const clean: taller.WorkOrderInput = {
    title: input.title.trim(),
    projectId: input.projectId || null,
    assigneeId: input.assigneeId || null,
    dueDate: input.dueDate || null,
    notes: input.notes?.trim() || null,
  };
  if (!clean.title) return { ok: false, error: "Falta el título." };
  const res = await run(async () => {
    if (id) {
      await taller.updateWorkOrder(id, clean);
      return id;
    }
    return taller.createWorkOrder(clean);
  });
  if (res.ok) {
    await pushNow();
    revalidate([clean.projectId, previousProjectId]);
  }
  return res;
}

export async function setWorkOrderStatusAction(id: string, status: WorkOrderStatus, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  if (!WORK_ORDER_STATUSES.includes(status)) return { ok: false, error: "Estado inválido." };
  const res = await run(async () => {
    await taller.setWorkOrderStatus(id, status);
    return null;
  });
  if (res.ok) {
    await pushNow();
    revalidate([projectId]);
  }
  return res;
}

/** Borra el trabajo y manda sus archivos a la papelera de Drive (se recuperan ahí por 30 días). */
export async function deleteWorkOrderAction(id: string, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const files = await taller.deleteWorkOrder(id);
    if (driveEnabled()) await Promise.all(files.map((f) => trashItem(f).catch(() => undefined)));
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

/**
 * La carpeta donde viven los archivos del trabajo: la subcarpeta CNC del proyecto (si el proyecto tiene carpeta en
 * Drive), o TALLER/CNC para los internos y los proyectos sin carpeta. Se guarda en el trabajo la primera vez.
 */
async function workOrderFolder(id: string): Promise<string> {
  const info = await taller.getWorkOrderFolderInfo(id);
  if (info.folderId) return info.folderId;
  const root = driveRoot();
  if (!driveEnabled() || !root) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const projectFolder = info.projectId ? await taller.getProjectDriveFolder(info.projectId) : null;
  const base = projectFolder ?? (await ensureSubfolders(root, ["TALLER"])).get("TALLER")!;
  const cnc = (await ensureSubfolders(base, ["CNC"])).get("CNC")!;
  await taller.setWorkOrderFolder(id, cnc);
  return cnc;
}

/** Abre la subida de un archivo: el navegador lo manda directo a Drive (sin pasar por el servidor). */
export async function startWorkOrderUploadAction(id: string, name: string, mimeType: string, size: number): Promise<Result<string>> {
  await requireModule("taller");
  if (size > WORK_ORDER_FILE_MAX)
    return { ok: false, error: `«${name}» pesa más de 4 MB: la app no lo podría descargar después. Los DXF suelen pesar menos de 200 KB.` };
  const origin = (await headers()).get("origin");
  return run(async () => startUpload(await workOrderFolder(id), name, mimeType, size, origin));
}

/** Anota en el trabajo los archivos ya subidos (comprueba que de verdad estén en su carpeta). Refresca una sola vez. */
export async function registerWorkOrderFilesAction(
  id: string,
  files: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null }[],
  projectId: string | null,
): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const folder = await workOrderFolder(id);
    for (const file of files) {
      const item = await getItem(file.driveFileId);
      if (item.parentId !== folder) throw new Error(`«${file.name}» no quedó en la carpeta del trabajo.`);
      await taller.addWorkOrderFile(id, { ...file, name: item.name, mimeType: item.mimeType, sizeBytes: item.size ?? file.sizeBytes });
    }
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

/** Quita un archivo del trabajo y lo manda a la papelera de Drive. */
export async function removeWorkOrderFileAction(fileId: string, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const driveId = await taller.removeWorkOrderFile(fileId);
    if (driveEnabled()) await trashItem(driveId).catch(() => undefined);
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}
