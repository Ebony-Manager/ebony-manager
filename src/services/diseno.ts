import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ItemUpdate = Database["public"]["Tables"]["project_items"]["Update"];
import type { BoardItem, ItemEvent, ItemFile, ItemFileKind, ItemStage, ProjectItem } from "@/types/diseno";

/**
 * Diseño · los ítems de cada proyecto y sus etapas. Permiso Diseño, Proyectos o Contratistas (la RLS lo exige
 * igual). Las etapas solo avanzan con sus acciones (ver acciones de Diseño); aquí no se valida el orden.
 */

const ITEM_SELECT = "*, project_item_files(id, kind, round, drive_file_id, name, mime_type, size_bytes, created_at)";

type ItemRow = {
  id: string;
  project_id: string;
  area: string;
  name: string;
  kind: string;
  sort_order: number;
  stage: string;
  stage_since: string;
  round: number;
  area_not_ready: boolean;
  next_visit: string | null;
  notes: string | null;
  quote_section_id: string | null;
  project_item_files: { id: string; kind: string; round: number; drive_file_id: string; name: string; mime_type: string | null; size_bytes: number | null; created_at: string }[] | null;
};

function mapItem(r: ItemRow): ProjectItem {
  return {
    id: r.id,
    projectId: r.project_id,
    area: r.area,
    name: r.name,
    kind: r.kind,
    sortOrder: r.sort_order,
    stage: r.stage as ItemStage,
    stageSince: r.stage_since,
    round: r.round,
    areaNotReady: r.area_not_ready,
    nextVisit: r.next_visit,
    notes: r.notes,
    fromQuote: !!r.quote_section_id,
    files: (r.project_item_files ?? [])
      .map(
        (f): ItemFile => ({
          id: f.id,
          kind: f.kind as ItemFileKind,
          round: f.round,
          driveFileId: f.drive_file_id,
          name: f.name,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          createdAt: f.created_at,
        }),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function getProjectItems(projectId: string): Promise<ProjectItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_items").select(ITEM_SELECT).eq("project_id", projectId).order("sort_order").order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ItemRow[]).map(mapItem);
}

export async function getItem(id: string): Promise<ProjectItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_items").select(ITEM_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapItem(data as unknown as ItemRow) : null;
}

/** El tablero: los ítems que siguen en diseño (sin los que ya están en producción) de los proyectos activos. */
export async function getBoardItems(): Promise<BoardItem[]> {
  const supabase = await createClient();
  const [{ data, error }, names] = await Promise.all([
    supabase
      .from("project_items")
      .select(`${ITEM_SELECT}, projects!inner(name, status)`)
      .neq("stage", "en_produccion")
      .eq("projects.status", "ACTIVE")
      .order("stage_since"),
    supabase.rpc("project_designer_names"),
  ]);
  if (error) throw new Error(error.message);
  const designers = new Map((names.data ?? []).map((r) => [r.project_id, r.names as string[]]));
  return ((data ?? []) as unknown as (ItemRow & { projects: { name: string } })[]).map((r) => ({
    ...mapItem(r),
    projectName: r.projects.name,
    designers: designers.get(r.project_id) ?? [],
  }));
}

export async function getItemEvents(itemId: string): Promise<ItemEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_item_events").select("*").eq("item_id", itemId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id,
    kind: e.kind as ItemEvent["kind"],
    fromStage: e.from_stage as ItemStage | null,
    toStage: e.to_stage as ItemStage | null,
    detail: e.detail,
    actorId: e.actor_id,
    createdAt: e.created_at,
  }));
}

export interface ItemInput {
  area: string;
  name: string;
  kind: string;
}

export async function createItems(projectId: string, items: ItemInput[]): Promise<void> {
  const supabase = await createClient();
  const { data: last } = await supabase.from("project_items").select("sort_order").eq("project_id", projectId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  let next = (last?.sort_order ?? 0) + 1;
  const { error } = await supabase
    .from("project_items")
    .insert(items.map((i) => ({ project_id: projectId, area: i.area.trim(), name: i.name.trim(), kind: i.kind.trim(), sort_order: next++ })));
  if (error) throw new Error(error.message);
}

export async function updateItem(id: string, patch: Partial<ItemInput> & { areaNotReady?: boolean; nextVisit?: string | null; notes?: string | null }): Promise<void> {
  const supabase = await createClient();
  const row: ItemUpdate = {};
  if (patch.area !== undefined) row.area = patch.area.trim();
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.kind !== undefined) row.kind = patch.kind.trim();
  if (patch.areaNotReady !== undefined) row.area_not_ready = patch.areaNotReady;
  if (patch.nextVisit !== undefined) row.next_visit = patch.nextVisit;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const { error } = await supabase.from("project_items").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setItemStage(id: string, stage: ItemStage, round?: number): Promise<void> {
  const supabase = await createClient();
  const row: ItemUpdate = { stage };
  if (round !== undefined) row.round = round;
  if (stage !== "por_medir") row.area_not_ready = false;
  const { error } = await supabase.from("project_items").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Borra el ítem y devuelve sus archivos de Drive (para mandarlos a la papelera). */
export async function deleteItem(id: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("project_item_files").select("drive_file_id").eq("item_id", id);
  const { error } = await supabase.from("project_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => f.drive_file_id);
}

export async function addItemFiles(
  itemId: string,
  files: { kind: ItemFileKind; round: number; driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null }[],
): Promise<void> {
  if (files.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("project_item_files").insert(
    files.map((f) => ({ item_id: itemId, kind: f.kind, round: f.round, drive_file_id: f.driveFileId, name: f.name, mime_type: f.mimeType, size_bytes: f.sizeBytes })),
  );
  if (error) throw new Error(error.message);
}

export async function removeItemFile(fileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_item_files").delete().eq("id", fileId).select("drive_file_id").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.drive_file_id ?? null;
}

export async function importQuoteItems(projectId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_quote_items", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function quoteItemsPending(projectId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_items_pending", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
