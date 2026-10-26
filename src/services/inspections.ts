import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  INSPECTION_PHOTOS_BUCKET,
  type Inspection,
  type InspectionItemStatus,
  type InspectionKind,
  type InspectionPainter,
  type InspectionResponsible,
  type InspectionPhotoKind,
  type InspectionOverview,
  type InspectionProject,
  type InspectionProjectCard,
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

/**
 * El inicio de Inspecciones: las obras con visitas (con sus pendientes y una
 * miniatura) y las últimas visitas. Solo se firman las miniaturas.
 */
export async function getInspectionOverview(recentLimit = 10): Promise<InspectionOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select("id, project_id, visited_on, notes, created_by_name, created_at, inspection_items(status, created_at, inspection_photos(path, sort_order))")
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const visits = data ?? [];

  type Item = { status: string; created_at: string; inspection_photos: { path: string; sort_order: number }[] | null };
  // La primera foto de los detalles, del más nuevo al más viejo (o al revés).
  const photoOf = (items: Item[], newest: boolean) => {
    const sorted = [...items].sort((a, b) => (newest ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));
    for (const i of sorted) {
      const p = [...(i.inspection_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      if (p) return p.path;
    }
    return null;
  };

  // Las visitas vienen de la más nueva a la más vieja: la primera foto que aparece es la más reciente.
  const cards = new Map<string, InspectionProjectCard & { pendingPhoto: string | null; anyPhoto: string | null }>();
  for (const v of visits) {
    const items = v.inspection_items ?? [];
    const pending = items.filter((i) => i.status !== "resuelto");
    const c = cards.get(v.project_id) ?? { projectId: v.project_id, visits: 0, pending: 0, resolved: 0, lastVisit: v.visited_on, thumbUrl: null, pendingPhoto: null, anyPhoto: null };
    c.visits += 1;
    c.pending += pending.length;
    c.resolved += items.length - pending.length;
    c.pendingPhoto ??= photoOf(pending, true);
    c.anyPhoto ??= photoOf(items, true);
    cards.set(v.project_id, c);
  }
  const cardList = [...cards.values()].map(({ pendingPhoto, anyPhoto, ...c }) => ({ ...c, thumbPath: pendingPhoto ?? anyPhoto }));
  const recent = visits.slice(0, recentLimit).map((v) => {
    const items = v.inspection_items ?? [];
    return {
      id: v.id,
      projectId: v.project_id,
      visitedOn: v.visited_on,
      createdByName: v.created_by_name,
      notes: v.notes,
      items: items.length,
      pending: items.filter((i) => i.status !== "resuelto").length,
      // De la visita, la foto del primer detalle.
      thumbPath: photoOf(items, false),
    };
  });

  const paths = [...new Set([...cardList, ...recent].map((x) => x.thumbPath).filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const signed = await supabase.storage.from(INSPECTION_PHOTOS_BUCKET).createSignedUrls(paths, 3600);
    for (const d of signed.data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  const url = (p: string | null) => (p ? urls.get(p) ?? null : null);

  return {
    projects: cardList
      .map(({ thumbPath, ...c }) => ({ ...c, thumbUrl: url(thumbPath) }))
      .sort((a, b) => b.pending - a.pending || b.lastVisit.localeCompare(a.lastVisit)),
    recent: recent.map(({ thumbPath, ...r }) => ({ ...r, thumbUrl: url(thumbPath) })),
  };
}

/** Los contratistas pintores (solo id y nombre; también los inactivos, para mostrar nombres viejos). */
export async function getInspectionPainters(): Promise<InspectionPainter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_painters");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, active: p.active }));
}

const asKind = (k: string | null): InspectionKind | null => (k === "pintura" || k === "carpinteria" || k === "otro" ? k : null);

/** Las visitas de un proyecto (la más reciente primero), con sus detalles y fotos firmadas. */
export async function getProjectInspections(projectId: string): Promise<Inspection[]> {
  const supabase = await createClient();
  const painters = new Map((await getInspectionPainters()).map((p) => [p.id, p.name]));
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "id, project_id, visited_on, notes, created_by_name, created_at, inspection_items(id, inspection_id, area, comment, kind, painter_id, responsible, third_party, status, resolved_at, resolved_by_name, sort_order, created_at, inspection_photos(id, path, kind, sort_order, created_at))"
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
      kind: asKind(i.kind),
      painterId: i.painter_id,
      painterName: i.painter_id ? (painters.get(i.painter_id) ?? null) : null,
      responsible: i.responsible === "tercero" ? "tercero" : "ebony",
      thirdParty: i.third_party,
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
  kind: InspectionKind | null;
  painterId: string | null;
  responsible: InspectionResponsible;
  thirdParty: string | null;
}

/** Las columnas de un detalle (el pintor solo en pintura; el "quién" solo con tercero). */
function itemColumns(input: InspectionItemInput) {
  return {
    area: input.area?.trim() || null,
    comment: input.comment.trim(),
    kind: input.kind,
    painter_id: input.kind === "pintura" ? input.painterId : null,
    responsible: input.responsible,
    third_party: input.responsible === "tercero" ? input.thirdParty?.trim() || null : null,
  };
}

/** Agrega varios detalles (al final de la visita, en ese orden), cada uno con sus fotos ya subidas. */
export async function addInspectionItems(inspectionId: string, entries: { input: InspectionItemInput; photoPaths: string[] }[]): Promise<string[]> {
  if (entries.length === 0) return [];
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("inspection_items")
    .select("sort_order")
    .eq("inspection_id", inspectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("inspection_items")
    .insert(entries.map((e, i) => ({ inspection_id: inspectionId, ...itemColumns(e.input), sort_order: start + i })))
    .select("id, sort_order");
  if (error) throw new Error(error.message);
  const ids = [...(data ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id);
  for (let i = 0; i < entries.length; i++) await addInspectionPhotos(ids[i], entries[i].photoPaths, "antes");
  return ids;
}

export async function updateInspectionItem(id: string, input: InspectionItemInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("inspection_items").update(itemColumns(input)).eq("id", id);
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
