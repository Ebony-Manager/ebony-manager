"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createFolder, driveRoot, folderUrl, listFolder, startUpload, type DriveItem } from "@/lib/google/drive";

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

/** La carpeta de una oportunidad (la crea la primera vez, con el nombre del proyecto o de quiénes). */
export async function ensureOpportunityFolderAction(id: string): Promise<DriveResult<string>> {
  await requireModule("cotizacion");
  return run(async () => {
    const supabase = await createClient();
    const { data: opp, error } = await supabase
      .from("sales_opportunities")
      .select("id, title, location, drive_folder_id, designer_id, client_id, project_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    if (opp.drive_folder_id) return opp.drive_folder_id;

    // Si ya está aprobada y el proyecto tiene carpeta, usa esa.
    if (opp.project_id) {
      const { data: project } = await supabase.from("projects").select("drive_folder_id").eq("id", opp.project_id).maybeSingle();
      if (project?.drive_folder_id) {
        await supabase.from("sales_opportunities").update({ drive_folder_id: project.drive_folder_id, drive_folder_url: folderUrl(project.drive_folder_id) }).eq("id", id);
        return project.drive_folder_id;
      }
    }

    const ids = [opp.designer_id, opp.client_id].filter((v): v is string => !!v);
    const { data: people } = ids.length ? await supabase.from("clients").select("id, name").in("id", ids) : { data: [] };
    const names = ids.map((pid) => (people ?? []).find((p) => p.id === pid)?.name).filter(Boolean);
    const name = [opp.title?.trim() || null, names.join(" · ") || null].filter(Boolean).join(" — ") || "Oportunidad";

    const folderId = await createFolder(name, root());
    const { error: saveError } = await supabase
      .from("sales_opportunities")
      .update({ drive_folder_id: folderId, drive_folder_url: folderUrl(folderId) })
      .eq("id", id);
    if (saveError) throw new Error(saveError.message);
    revalidatePath("/cotizacion", "layout");
    return folderId;
  });
}

/** La carpeta de un proyecto (la heredada de su oportunidad, o una nueva con su nombre). */
export async function ensureProjectFolderAction(id: string): Promise<DriveResult<string>> {
  await requireAnyModule(...VIEWERS);
  return run(async () => {
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("id, name, drive_folder_id").eq("id", id).single();
    if (error) throw new Error(error.message);
    if (project.drive_folder_id) return project.drive_folder_id;
    const folderId = await createFolder(project.name, root());
    const { data: saved, error: saveError } = await supabase.rpc("set_project_drive_folder", { p_id: id, p_folder_id: folderId });
    if (saveError) throw new Error(saveError.message);
    revalidatePath(`/proyectos/${id}`);
    return (saved as string | null) ?? folderId;
  });
}
