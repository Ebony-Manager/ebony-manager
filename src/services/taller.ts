import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TallerPerson, TallerProject, WorkOrder, WorkOrderEvent, WorkOrderStatus } from "@/types/taller";

/**
 * Taller · Trabajos (pide el permiso `taller`; la RLS lo exige igual). Nombres, fotos y proyectos salen de
 * consultas protegidas (`taller_people`, `taller_projects`): quien tiene Taller no necesita ver Personal (sueldos)
 * ni Proyectos. Una consulta por cosa, sin pedir de más.
 */

const ORDER_SELECT = "*, work_order_files(id, drive_file_id, name, mime_type, size_bytes, created_at)";

type OrderRow = {
  id: string;
  kind: string;
  title: string;
  project_id: string | null;
  assignee_employee_id: string | null;
  requested_by: string | null;
  status: string;
  due_date: string | null;
  started_at: string | null;
  done_at: string | null;
  notes: string | null;
  created_at: string;
  work_order_files: { id: string; drive_file_id: string; name: string; mime_type: string | null; size_bytes: number | null; created_at: string }[] | null;
};

function mapOrder(r: OrderRow): WorkOrder {
  return {
    id: r.id,
    kind: "cnc",
    title: r.title,
    projectId: r.project_id,
    projectName: null,
    assigneeId: r.assignee_employee_id,
    requestedBy: r.requested_by,
    status: r.status as WorkOrderStatus,
    dueDate: r.due_date,
    startedAt: r.started_at,
    doneAt: r.done_at,
    notes: r.notes,
    createdAt: r.created_at,
    files: (r.work_order_files ?? [])
      .map((f) => ({ id: f.id, driveFileId: f.drive_file_id, name: f.name, mimeType: f.mime_type, sizeBytes: f.size_bytes, createdAt: f.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function getTallerPeople(): Promise<TallerPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("taller_people");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ employeeId: p.employee_id, name: p.name, position: p.position, photoPath: p.photo_path, userId: p.user_id }));
}

export async function getTallerProjects(): Promise<TallerProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("taller_projects");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, active: p.status !== "COMPLETED" }));
}

/**
 * Trabajos: los abiertos y los listos/cancelados de los últimos 60 días (lo más viejo queda en la base, para los
 * tableros de la etapa 5). Con `projectId`, solo los de ese proyecto (todos).
 */
export async function getWorkOrders(filter: { projectId?: string } = {}): Promise<WorkOrder[]> {
  const supabase = await createClient();
  let q = supabase.from("work_orders").select(ORDER_SELECT).order("due_date", { ascending: true, nullsFirst: false }).order("created_at");
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  else {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    q = q.or(`status.in.(por_hacer,en_proceso),updated_at.gte.${since}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

/** Pone el nombre del proyecto a cada trabajo (los nombres salen de `taller_projects`, pedida en paralelo). */
export function withProjectNames(orders: WorkOrder[], projects: TallerProject[]): WorkOrder[] {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return orders.map((o) => ({ ...o, projectName: o.projectId ? (names.get(o.projectId) ?? null) : null }));
}

export async function getWorkOrderEvents(workOrderId: string): Promise<WorkOrderEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_order_events")
    .select("id, kind, actor_id, from_status, to_status, detail, created_at")
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id,
    kind: e.kind as WorkOrderEvent["kind"],
    actorId: e.actor_id,
    fromStatus: e.from_status as WorkOrderStatus | null,
    toStatus: e.to_status as WorkOrderStatus | null,
    detail: e.detail,
    createdAt: e.created_at,
  }));
}

export interface WorkOrderInput {
  title: string;
  projectId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  notes: string | null;
}

export async function createWorkOrder(input: WorkOrderInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({ kind: "cnc", title: input.title, project_id: input.projectId, assignee_employee_id: input.assigneeId, due_date: input.dueDate, notes: input.notes })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateWorkOrder(id: string, input: WorkOrderInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({ title: input.title, project_id: input.projectId, assignee_employee_id: input.assigneeId, due_date: input.dueDate, notes: input.notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("work_orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra el trabajo; devuelve los archivos que tenía (para mandarlos a la papelera de Drive). */
export async function deleteWorkOrder(id: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: files } = await supabase.from("work_order_files").select("drive_file_id").eq("work_order_id", id);
  const { error } = await supabase.from("work_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return (files ?? []).map((f) => f.drive_file_id);
}

/** La carpeta del trabajo y el proyecto al que pertenece (para saber dónde guardar sus archivos). */
export async function getWorkOrderFolderInfo(id: string): Promise<{ folderId: string | null; projectId: string | null; title: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("work_orders").select("drive_folder_id, project_id, title").eq("id", id).single();
  if (error) throw new Error(error.message);
  return { folderId: data.drive_folder_id, projectId: data.project_id, title: data.title };
}

export async function setWorkOrderFolder(id: string, folderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("work_orders").update({ drive_folder_id: folderId }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getProjectDriveFolder(projectId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("taller_project_folder", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function addWorkOrderFile(workOrderId: string, file: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_order_files")
    .insert({ work_order_id: workOrderId, drive_file_id: file.driveFileId, name: file.name, mime_type: file.mimeType, size_bytes: file.sizeBytes });
  if (error) throw new Error(error.message);
}

/** Quita un archivo del trabajo; devuelve su id de Drive (para mandarlo a la papelera). */
export async function removeWorkOrderFile(fileId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("work_order_files").delete().eq("id", fileId).select("drive_file_id").single();
  if (error) throw new Error(error.message);
  return data.drive_file_id;
}

/** ¿Este archivo de Drive pertenece a algún trabajo? (la RLS solo deja verlo a quien tiene Taller). */
export async function isWorkOrderFile(driveFileId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("work_order_files").select("id").eq("drive_file_id", driveFileId).maybeSingle();
  return !!data;
}
