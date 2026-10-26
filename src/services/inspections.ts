import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  INSPECTION_PHOTOS_BUCKET,
  type Inspection,
  type InspectionItemStatus,
  type InspectionPhotoKind,
  type InspectionProject,
  type InspectionProjectStats,
} from "@/types/inspections";

/**
 * Inspecciones de obra (pide `inspecciones`; la RLS lo exige igual). Las
 * fotos las sube el navegador al bucket privado y acá solo se guardan sus
 * rutas; al leer se firman por 1 h.
 */

/** Proyectos que puede ver quien inspecciona: solo nombre, cliente, ubicación y estado. */
export async function getInspectionProjects(id?: string): Promise<InspectionProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_projects", id ? { p_id: id } : {});
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client_name,
    location: p.location,
    active: p.status !== "COMPLETED",
  }));
}

export async function getInspectionProject(id: string): Promise<InspectionProject | null> {
  return (await getInspectionProjects(id))[0] ?? null;
}

/** Visitas, pendientes y resueltos por proyecto (solo los que tienen alguna visita). */
export async function getInspectionStats(): Promise<Record<string, InspectionProjectStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inspections").select("project_id, visited_on, inspection_items(status)");
  if (error) throw new Error(error.message);
  const out: Record<string, InspectionProjectStats> = {};
  for (const v of data ?? []) {
    const s = (out[v.project_id] ??= { visits: 0, pending: 0, resolved: 0, lastVisit: null });
    s.visits += 1;
    if (!s.lastVisit || v.visited_on > s.lastVisit) s.lastVisit = v.visited_on;
    for (const it of v.inspection_items ?? []) {
      if (it.status === "resuelto") s.resolved += 1;
      else s.pending += 1;
    }
  }
  return out;
}

/** Las visitas de un proyecto (la más reciente primero), con sus detalles y fotos firmadas. */
export async function getProjectInspections(projectId: string): Promise<Inspection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "id, project_id, visited_on, notes, created_by_name, created_at, inspection_items(id, inspection_id, area, comment, status, resolved_at, resolved_by_name, sort_order, created_at, inspection_photos(id, path, kind, sort_order, created_at))"
    )
    .eq("project_id", projectId)
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const paths = rows.flatMap((v) => (v.inspection_items ?? []).flatMap((i) => (i.inspection_photos ?? []).map((p) => p.path)));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await supabase.storage.from(INSPECTION_PHOTOS_BUCKET).createSignedUrls(paths, 3600);
    for (const d of signed.data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }

  const byOrder = <T extends { sort_order: number; created_at: string }>(a: T, b: T) =>
    a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

  return rows.map((v) => ({
    id: v.id,
    projectId: v.project_id,
    visitedOn: v.visited_on,
    notes: v.notes,
    createdByName: v.created_by_name,
    createdAt: v.created_at,
    items: [...(v.inspection_items ?? [])].sort(byOrder).map((i) => ({
      id: i.id,
      inspectionId: i.inspection_id,
      area: i.area,
      comment: i.comment,
      status: i.status === "resuelto" ? "resuelto" : "pendiente",
      resolvedAt: i.resolved_at,
      resolvedByName: i.resolved_by_name,
      createdAt: i.created_at,
      photos: [...(i.inspection_photos ?? [])].sort(byOrder).map((p) => ({
        id: p.id,
        path: p.path,
        kind: p.kind === "despues" ? "despues" : "antes",
        url: urls.get(p.path) ?? null,
      })),
    })),
  }));
}

export interface InspectionInput {
  visitedOn: string;
  notes: string | null;
}

export async function createInspection(projectId: string, input: InspectionInput, byName: string | null): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .insert({ project_id: projectId, visited_on: input.visitedOn, notes: input.notes?.trim() || null, created_by_name: byName })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateInspection(id: string, input: InspectionInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inspections")
    .update({ visited_on: input.visitedOn, notes: input.notes?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra la visita con sus detalles (cascada) y sus fotos del bucket. */
export async function deleteInspection(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: items } = await supabase.from("inspection_items").select("inspection_photos(path)").eq("inspection_id", id);
  const paths = (items ?? []).flatMap((i) => (i.inspection_photos ?? []).map((p) => p.path));
  const { error } = await supabase.from("inspections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removeFiles(paths);
}

export interface InspectionItemInput {
  area: string | null;
  comment: string;
}

/** Agrega un detalle (al final de la visita) con las fotos ya subidas. */
export async function addInspectionItem(inspectionId: string, input: InspectionItemInput, photoPaths: string[]): Promise<string> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("inspection_items")
    .select("sort_order")
    .eq("inspection_id", inspectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("inspection_items")
    .insert({ inspection_id: inspectionId, area: input.area?.trim() || null, comment: input.comment.trim(), sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await addInspectionPhotos(data.id, photoPaths, "antes");
  return data.id;
}

export async function updateInspectionItem(id: string, input: InspectionItemInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inspection_items")
    .update({ area: input.area?.trim() || null, comment: input.comment.trim() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteInspectionItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: photos } = await supabase.from("inspection_photos").select("path").eq("item_id", id);
  const { error } = await supabase.from("inspection_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removeFiles((photos ?? []).map((p) => p.path));
}

export async function setInspectionItemStatus(id: string, status: InspectionItemStatus, byName: string | null): Promise<void> {
  const supabase = await createClient();
  const resolved = status === "resuelto";
  const { error } = await supabase
    .from("inspection_items")
    .update({ status, resolved_at: resolved ? new Date().toISOString() : null, resolved_by_name: resolved ? byName : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addInspectionPhotos(itemId: string, paths: string[], kind: InspectionPhotoKind): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("inspection_photos")
    .select("sort_order")
    .eq("item_id", itemId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("inspection_photos")
    .insert(paths.map((path, i) => ({ item_id: itemId, path, kind, sort_order: start + i })));
  if (error) throw new Error(error.message);
}

export async function deleteInspectionPhoto(id: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inspection_photos").delete().eq("id", id).select("path").maybeSingle();
  if (error) throw new Error(error.message);
  if (data) await removeFiles([data.path]);
}

/** Quita archivos del bucket; si falla, quedan huérfanos pero nada se rompe. */
async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(INSPECTION_PHOTOS_BUCKET).remove(paths);
  if (error) console.error("No se pudieron borrar fotos de inspección", error);
}
