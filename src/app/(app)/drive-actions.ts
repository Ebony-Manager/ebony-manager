"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  CLIENT_INFO_FOLDER,
  PROJECT_SUBFOLDERS,
  createFolder,
  driveRoot,
  ensureSubfolders,
  folderUrl,
  listFolder,
  startUpload,
  trashItem,
  type DriveItem,
} from "@/lib/google/drive";

// Archivos de Drive (oportunidades de Ventas y proyectos). Ver lib/google/drive.ts.

export type DriveResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<DriveResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

const VIEWERS = ["cotizacion", "proyectos", "contratistas"] as const;

export async function listDriveFolderAction(folderId: string): Promise<DriveResult<DriveItem[]>> {
  await requireAnyModule(...VIEWERS);
  return run(() => listFolder(folderId));
}

export async function createDriveSubfolderAction(parentId: string, name: string): Promise<DriveResult<string>> {
  await requireAnyModule(...VIEWERS);
  return run(() => createFolder(name, parentId));
}

/** Borra un archivo o subcarpeta (va a la papelera de Drive). Nunca la raíz. */
export async function trashDriveItemAction(id: string): Promise<DriveResult<null>> {
  await requireAnyModule(...VIEWERS);
  return run(async () => {
    if (id === driveRoot()) throw new Error("No se puede borrar la carpeta raíz.");
    await trashItem(id);
    return null;
  });
}

export async function startDriveUploadAction(parentId: string, name: string, mimeType: string, size: number): Promise<DriveResult<string>> {
  await requireAnyModule(...VIEWERS);
  const origin = (await headers()).get("origin");
  return run(() => startUpload(parentId, name, mimeType, size, origin));
}

function root(): string {
  const id = driveRoot();
  if (!id) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  return id;
}

/** Carpeta creada (o la que ya había) y dónde subir lo que manda el cliente. */
export interface FolderReady {
  folderId: string;
  /** INFORMACION DE CLIENTE: ahí caen los archivos al crear la oportunidad. */
  uploadTo: string;
}

/**
 * La carpeta de una oportunidad, como se organizan hoy: "Firma - Proyecto"
 * con su subcarpeta INFORMACION DE CLIENTE (la crea la primera vez). Las demás
 * subcarpetas (medidas, sketchup…) se crean al aprobarla.
 */
export async function ensureOpportunityFolderAction(id: string): Promise<DriveResult<FolderReady>> {
  await requireModule("cotizacion");
  return run(async () => {
    const supabase = await createClient();
    const { data: opp, error } = await supabase
      .from("sales_opportunities")
      .select("id, title, location, drive_folder_id, designer_id, client_id, project_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    let folderId = opp.drive_folder_id;

    // Si ya está aprobada y el proyecto tiene carpeta, usa esa.
    if (!folderId && opp.project_id) {
      const { data: project } = await supabase.from("projects").select("drive_folder_id").eq("id", opp.project_id).maybeSingle();
      folderId = project?.drive_folder_id ?? null;
    }

    if (!folderId) {
      const ids = [opp.designer_id, opp.client_id].filter((v): v is string => !!v);
      const { data: people } = ids.length ? await supabase.from("clients").select("id, name").in("id", ids) : { data: [] };
      const nameOf = (pid: string | null) => (pid ? (people ?? []).find((p) => p.id === pid)?.name : undefined);
      // "MM Interiores - The Colonial 23C": la firma (o el cliente) y el proyecto.
      const who = nameOf(opp.designer_id) ?? nameOf(opp.client_id);
      const what = opp.title?.trim() || opp.location?.trim() || null;
      folderId = await createFolder([who, what].filter(Boolean).join(" - ") || "Oportunidad", root());
    }
    if (folderId !== opp.drive_folder_id) {
      const { error: saveError } = await supabase
        .from("sales_opportunities")
        .update({ drive_folder_id: folderId, drive_folder_url: folderUrl(folderId) })
        .eq("id", id);
      if (saveError) throw new Error(saveError.message);
    }
    const sub = await ensureSubfolders(folderId, [CLIENT_INFO_FOLDER]);
    revalidatePath("/cotizacion", "layout");
    return { folderId, uploadTo: sub.get(CLIENT_INFO_FOLDER)! };
  });
}

/** La carpeta de un proyecto (la heredada de su oportunidad, o una nueva con su nombre), con todas sus subcarpetas. */
export async function ensureProjectFolderAction(id: string): Promise<DriveResult<FolderReady>> {
  await requireAnyModule(...VIEWERS);
  return run(async () => {
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("id, name, drive_folder_id").eq("id", id).single();
    if (error) throw new Error(error.message);
    let folderId = project.drive_folder_id;
    if (!folderId) {
      const created = await createFolder(project.name, root());
      const { data: saved, error: saveError } = await supabase.rpc("set_project_drive_folder", { p_id: id, p_folder_id: created });
      if (saveError) throw new Error(saveError.message);
      folderId = (saved as string | null) ?? created;
    }
    const sub = await ensureSubfolders(folderId, PROJECT_SUBFOLDERS);
    revalidatePath(`/proyectos/${id}`);
    return { folderId, uploadTo: sub.get(CLIENT_INFO_FOLDER)! };
  });
}
