import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PaintSample, PaintSampleKind, TallerPainter, TallerPerson, TallerProject, VeneerType, WorkOrder, WorkOrderEvent, WorkOrderFile, WorkOrderKind, WorkOrderStatus } from "@/types/taller";

/**
 * Taller · Trabajos (pide el permiso `taller`; la RLS lo exige igual). Nombres, fotos y proyectos salen de
 * consultas protegidas (`taller_people`, `taller_projects`): quien tiene Taller no necesita ver Personal (sueldos)
 * ni Proyectos. Una consulta por cosa, sin pedir de más.
 */

const ORDER_SELECT =
  "*, work_order_files(id, drive_file_id, name, mime_type, size_bytes, created_at, sample_id, role), paint_samples(id, name, kind, veneer_type_id, official_code, sort_order)";

type OrderRow = {
  id: string;
  kind: string;
  title: string;
  project_id: string | null;
  assignee_employee_id: string | null;
  assignee_contractor_id: string | null;
  requested_by: string | null;
  status: string;
  due_date: string | null;
  started_at: string | null;
  done_at: string | null;
  notes: string | null;
  created_at: string;
  work_order_files: { id: string; drive_file_id: string; name: string; mime_type: string | null; size_bytes: number | null; created_at: string; sample_id: string | null; role: string }[] | null;
  paint_samples: { id: string; name: string; kind: string; veneer_type_id: string | null; official_code: string | null; sort_order: number }[] | null;
};

function mapOrder(r: OrderRow): WorkOrder {
  return {
    id: r.id,
    kind: r.kind as WorkOrderKind,
    title: r.title,
    projectId: r.project_id,
    projectName: null,
    assigneeId: r.assignee_employee_id,
    assigneeContractorId: r.assignee_contractor_id,
    requestedBy: r.requested_by,
    status: r.status as WorkOrderStatus,
    dueDate: r.due_date,
    startedAt: r.started_at,
    doneAt: r.done_at,
    notes: r.notes,
    createdAt: r.created_at,
    files: (r.work_order_files ?? [])
      .map((f) => ({
        id: f.id,
        driveFileId: f.drive_file_id,
        name: f.name,
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        createdAt: f.created_at,
        sampleId: f.sample_id,
        role: f.role as WorkOrderFile["role"],
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    samples: (r.paint_samples ?? [])
      .map((x) => ({ id: x.id, name: x.name, kind: x.kind as PaintSampleKind, veneerTypeId: x.veneer_type_id, officialCode: x.official_code, sortOrder: x.sort_order }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
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
export async function getWorkOrders(filter: { projectId?: string; kind?: WorkOrder["kind"] } = {}): Promise<WorkOrder[]> {
  const supabase = await createClient();
  let q = supabase.from("work_orders").select(ORDER_SELECT).order("due_date", { ascending: true, nullsFirst: false }).order("created_at");
  if (filter.kind) q = q.eq("kind", filter.kind);
  // Por proyecto o por tipo (el control de colores): todo. Si no, el tablero: lo abierto y lo cerrado hace poco.
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  else if (filter.kind) {
    /* todo el historial */
  } else {
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
export async function getWorkOrderFolderInfo(id: string): Promise<{ folderId: string | null; projectId: string | null; title: string; kind: WorkOrderKind }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("work_orders").select("drive_folder_id, project_id, title, kind").eq("id", id).single();
  if (error) throw new Error(error.message);
  return { folderId: data.drive_folder_id, projectId: data.project_id, title: data.title, kind: data.kind as WorkOrderKind };
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

export async function addWorkOrderFile(
  workOrderId: string,
  file: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null; sampleId?: string | null; role?: WorkOrderFile["role"] },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("work_order_files").insert({
    work_order_id: workOrderId,
    drive_file_id: file.driveFileId,
    name: file.name,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    sample_id: file.sampleId ?? null,
    role: file.role ?? "archivo",
  });
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

// ── Muestras de pintura ────────────────────────────────────────────────

export interface SampleLineInput {
  /** null = muestra nueva. */
  id: string | null;
  name: string;
  kind: PaintSampleKind;
  veneerTypeId: string | null;
}

export interface SampleRequestInput {
  projectId: string | null;
  contractorId: string | null;
  dueDate: string | null;
  notes: string | null;
  samples: SampleLineInput[];
}

const sampleTitle = (samples: SampleLineInput[]) => samples.map((x) => x.name.trim()).filter(Boolean).join(", ");

/** Crea la solicitud y sus muestras; devuelve el id del trabajo y el de cada muestra (en el mismo orden). */
export async function createSampleRequest(input: SampleRequestInput): Promise<{ id: string; sampleIds: string[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      kind: "muestra",
      title: sampleTitle(input.samples),
      project_id: input.projectId,
      assignee_contractor_id: input.contractorId,
      due_date: input.dueDate,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const rows = input.samples.map((x, i) => ({ work_order_id: data.id, sort_order: i, name: x.name.trim(), kind: x.kind, veneer_type_id: x.kind === "chapilla" ? x.veneerTypeId : null }));
  const { data: inserted, error: sErr } = await supabase.from("paint_samples").insert(rows).select("id, sort_order");
  if (sErr) {
    await supabase.from("work_orders").delete().eq("id", data.id);
    throw new Error(sErr.message);
  }
  const ids = [...(inserted ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id);
  return { id: data.id, sampleIds: ids };
}

/** Edita la solicitud: datos generales y muestras (cambia, agrega y quita). Devuelve los ids de las muestras nuevas. */
export async function updateSampleRequest(id: string, input: SampleRequestInput): Promise<string[]> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({ title: sampleTitle(input.samples), project_id: input.projectId, assignee_contractor_id: input.contractorId, due_date: input.dueDate, notes: input.notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
  const { data: existing } = await supabase.from("paint_samples").select("id").eq("work_order_id", id);
  const keep = new Set(input.samples.map((x) => x.id).filter(Boolean));
  const gone = (existing ?? []).map((r) => r.id).filter((x) => !keep.has(x));
  if (gone.length) {
    const { error: dErr } = await supabase.from("paint_samples").delete().in("id", gone);
    if (dErr) throw new Error(dErr.message);
  }
  const created: string[] = [];
  for (const [i, x] of input.samples.entries()) {
    const row = { name: x.name.trim(), kind: x.kind, veneer_type_id: x.kind === "chapilla" ? x.veneerTypeId : null, sort_order: i };
    if (x.id) {
      const { error: uErr } = await supabase.from("paint_samples").update({ ...row, updated_at: new Date().toISOString() }).eq("id", x.id);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { data: ins, error: iErr } = await supabase.from("paint_samples").insert({ ...row, work_order_id: id }).select("id").single();
      if (iErr) throw new Error(iErr.message);
      created.push(ins.id);
    }
  }
  return created;
}

export async function setSampleOfficialCode(sampleId: string, code: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("paint_samples").update({ official_code: code, updated_at: new Date().toISOString() }).eq("id", sampleId);
  if (error) throw new Error(error.message);
}

/** La ficha de contratista de quien tiene la sesión (o null): para «Asignados a mí». */
export async function getMyContractorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_contractor_id");
  if (error) return null;
  return data ?? null;
}

export async function getTallerPainters(): Promise<TallerPainter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("taller_painters");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ contractorId: p.contractor_id, name: p.name, photoPath: p.photo_path, hasEmail: p.has_email, inTurn: p.in_turn, turnRank: p.turn_rank }));
}

/** Mete o saca a un pintor del turno de muestras (al entrar va al final del orden). */
export async function setPainterInTurn(contractorId: string, inTurn: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("sample_painters").select("contractor_id").eq("contractor_id", contractorId).maybeSingle();
  if (row) {
    const { error } = await supabase.from("sample_painters").update({ active: inTurn }).eq("contractor_id", contractorId);
    if (error) throw new Error(error.message);
    return;
  }
  if (!inTurn) return;
  const { data: last } = await supabase.from("sample_painters").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("sample_painters").insert({ contractor_id: contractorId, sort_order: (last?.sort_order ?? 0) + 1, active: true, last_turn_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function getVeneerTypes(): Promise<VeneerType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("veneer_types").select("id, name, active").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({ id: v.id, name: v.name, active: v.active }));
}

export async function addVeneerType(name: string): Promise<void> {
  const supabase = await createClient();
  const { data: last } = await supabase.from("veneer_types").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("veneer_types").insert({ name: name.trim(), sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) throw new Error(error.code === "23505" ? "Ese tipo de chapilla ya existe." : error.message);
}

export async function setVeneerTypeActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("veneer_types").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Correos para avisar: del pintor y de quien pidió (solo quien tiene Taller puede leerlos). */
export async function getContactEmails(contractorId: string | null, userId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("taller_contact_emails", { p_contractor: contractorId, p_user: userId });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return {
    contractorEmail: row?.contractor_email ?? null,
    contractorName: row?.contractor_name ?? null,
    userEmail: row?.user_email ?? null,
    userName: row?.user_name ?? null,
  };
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("work_orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export type { PaintSample };
