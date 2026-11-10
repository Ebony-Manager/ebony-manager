import "server-only";

import { createFolder, driveEnabled, driveRoot, findFoldersByName, getParents, moveItem } from "./drive";
import { stageForProject, shouldMove, type DriveStage } from "./stage-rules";

/**
 * La Unidad compartida se ordena en tres carpetas según cómo va el trabajo:
 * OPORTUNIDADES (en cotización), ACTIVOS (proyectos en curso) y TERMINADOS.
 * La app las busca por nombre (o las crea en la raíz si no están) y mueve la
 * carpeta de cada proyecto cuando cambia su estado. Mover no cambia el id ni
 * el enlace. Si Drive falla, el trabajo sigue: la carpeta se acomoda la
 * próxima vez que alguien abre Archivos.
 */

const cache = new Map<DriveStage, string>();

/** El id de la carpeta de una etapa: la que ya existe con ese nombre (mejor si está en la raíz) o una nueva en la raíz. */
export async function stageFolder(stage: DriveStage): Promise<string> {
  const known = cache.get(stage);
  if (known) return known;
  const root = driveRoot();
  if (!root) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const found = await findFoldersByName(stage);
  const id = (found.find((f) => f.parents.includes(root)) ?? found[0])?.id ?? (await createFolder(stage, root));
  cache.set(stage, id);
  return id;
}

async function allStageFolders(): Promise<string[]> {
  return Promise.all((["OPORTUNIDADES", "ACTIVOS", "TERMINADOS"] as const).map(stageFolder));
}

/**
 * Pone la carpeta en la etapa que le toca. Solo la mueve si hoy está en la
 * raíz o en otra de las tres etapas: una carpeta que alguien guardó en otro
 * lugar a propósito no se toca. Nunca lanza error.
 */
export async function placeFolder(folderId: string, stage: DriveStage): Promise<void> {
  if (!driveEnabled()) return;
  try {
    const [target, managed, parents] = await Promise.all([stageFolder(stage), allStageFolders(), getParents(folderId)]);
    const from = shouldMove(parents, target, [driveRoot()!, ...managed]);
    if (from) await moveItem(folderId, from, target);
  } catch (err) {
    cache.clear();
    console.error(`Drive: no se pudo mover la carpeta a ${stage}`, err);
  }
}

/** La carpeta de un proyecto, a ACTIVOS o TERMINADOS según su estado. */
export function placeProjectFolder(folderId: string, status: string | null | undefined): Promise<void> {
  return placeFolder(folderId, stageForProject(status));
}

/** Lee el proyecto y acomoda su carpeta (si tiene). Nunca lanza error. */
export async function syncProjectFolder(projectId: string): Promise<void> {
  if (!driveEnabled()) return;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("status, drive_folder_id").eq("id", projectId).maybeSingle();
    if (data?.drive_folder_id) await placeProjectFolder(data.drive_folder_id, data.status);
  } catch (err) {
    console.error("Drive: no se pudo acomodar la carpeta del proyecto", err);
  }
}
