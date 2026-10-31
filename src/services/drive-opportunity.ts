import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PROJECT_SUBFOLDERS, driveEnabled, ensureSubfolders, trashItem } from "@/lib/google/drive";

// Lo que hace Drive cuando Ventas aprueba o pierde una oportunidad. Lo llaman
// las acciones de Ventas (que ya piden el permiso); no es una acción suelta.


/** Al aprobar: la carpeta de la oportunidad recibe las subcarpetas del proyecto. Si falla, no frena la aprobación. */
export async function addProjectSubfolders(opportunityId: string): Promise<void> {
  if (!driveEnabled()) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("sales_opportunities").select("drive_folder_id").eq("id", opportunityId).maybeSingle();
    if (data?.drive_folder_id) await ensureSubfolders(data.drive_folder_id, PROJECT_SUBFOLDERS);
  } catch (err) {
    console.error("Drive: no se pudieron crear las subcarpetas del proyecto", err);
  }
}

/** Al perderla: su carpeta de Drive se borra (queda 30 días en la papelera de Drive). Nunca si ya es de un proyecto. */
export async function trashOpportunityFolder(opportunityId: string): Promise<void> {
  if (!driveEnabled()) return;
  const supabase = await createClient();
  const { data } = await supabase.from("sales_opportunities").select("drive_folder_id, project_id, stage").eq("id", opportunityId).maybeSingle();
  if (!data?.drive_folder_id || data.project_id || data.stage !== "perdida") return;
  try {
    await trashItem(data.drive_folder_id);
  } catch (err) {
    console.error("Drive: no se pudo borrar la carpeta de la oportunidad perdida", err);
    return;
  }
  await supabase.from("sales_opportunities").update({ drive_folder_id: null, drive_folder_url: null }).eq("id", opportunityId);
}
