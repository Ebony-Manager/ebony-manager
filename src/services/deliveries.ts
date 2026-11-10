import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ProjectDelivery } from "@/types/deliveries";

type Row = Database["public"]["Tables"]["project_deliveries"]["Row"];
const COLS =
  "id, project_id, project_name, submission_id, delivered_on, client_name, client_email, client_id_doc, address, items, photo_count, drive_folder_id, pdf_file_id, files_error, created_at";

function map(r: Omit<Row, "raw">): ProjectDelivery {
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    deliveredOn: r.delivered_on,
    clientName: r.client_name,
    clientEmail: r.client_email,
    clientIdDoc: r.client_id_doc,
    address: r.address,
    items: r.items,
    photoCount: r.photo_count,
    driveFolderId: r.drive_folder_id,
    pdfFileId: r.pdf_file_id,
    filesError: r.files_error,
    createdAt: r.created_at,
  };
}

/** Las actas de un proyecto, la más reciente primero. */
export async function getProjectDeliveries(projectId: string): Promise<ProjectDelivery[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_deliveries")
    .select(COLS)
    .eq("project_id", projectId)
    .order("delivered_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(map);
}

/** Actas que llegaron sin un proyecto reconocible (para asignarlas a mano). */
export async function getUnassignedDeliveries(): Promise<ProjectDelivery[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_deliveries").select(COLS).is("project_id", null).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(map);
}

export async function assignDelivery(id: string, projectId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_deliveries").update({ project_id: projectId }).eq("id", id);
  if (error) throw new Error(error.message);
}
