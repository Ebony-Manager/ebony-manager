import type { Inspection, InspectionItem, InspectionKind, InspectionResponsible } from "@/types/inspections";
import { normalizeSearchText } from "@/lib/search";

// Cómo se ven las inspecciones de un proyecto (y su PDF): agrupadas por visita,
// por área o todo junto, con filtros de estado, tipo, pintor y responsable.
// Sin React: lo usan la pantalla, el PDF y los tests.

/** Un detalle con la fecha de la visita a la que pertenece. */
export interface ItemWithVisit extends InspectionItem {
  visitedOn: string;
}

export const AREA_SUGGESTIONS = ["Cocina", "Closet principal", "Closet", "Walk-in closet", "Baño principal", "Baño", "Habitación principal", "Habitación", "Sala", "Comedor", "Cine", "Lavandería", "Estudio", "Mueble de TV", "Entrada"];

export type GroupBy = "visita" | "area" | "junto";

export interface ItemFilters {
  onlyPending: boolean;
  /** "sin" = sin clasificar (detalles de antes del tipo). */
  kind: InspectionKind | "sin" | "todos";
  painterId: string | "todos";
  responsible: InspectionResponsible | "todos";
}

export const DEFAULT_FILTERS: ItemFilters = { onlyPending: true, kind: "todos", painterId: "todos", responsible: "todos" };

/** ¿Hay algún filtro aparte de Pendientes/Todos? */
export function hasExtraFilters(f: ItemFilters): boolean {
  return f.kind !== "todos" || f.painterId !== "todos" || f.responsible !== "todos";
}

export function matchesFilters(item: InspectionItem, f: ItemFilters): boolean {
  if (f.onlyPending && item.status !== "pendiente") return false;
  if (f.kind === "sin" ? item.kind !== null : f.kind !== "todos" && item.kind !== f.kind) return false;
  if (f.painterId !== "todos" && item.painterId !== f.painterId) return false;
  if (f.responsible !== "todos" && item.responsible !== f.responsible) return false;
  return true;
}

export interface ItemGroup {
  key: string;
  /** null = sin título (Todo junto) o "Sin área". */
  title: string | null;
  /** Por visita: la visita (para su encabezado y acciones). */
  visit?: Inspection;
  items: ItemWithVisit[];
}

const areaKey = (a: string | null | undefined) => normalizeSearchText(a);
const byVisitThenCreated = (a: ItemWithVisit, b: ItemWithVisit) => a.visitedOn.localeCompare(b.visitedOn) || a.createdAt.localeCompare(b.createdAt);

/** Todos los detalles que pasan los filtros, cada uno con la fecha de su visita (en el orden de las visitas). */
export function filteredItems(inspections: readonly Inspection[], f: ItemFilters): ItemWithVisit[] {
  return inspections.flatMap((v) => v.items.filter((i) => matchesFilters(i, f)).map((i) => ({ ...i, visitedOn: v.visitedOn })));
}

/**
 * Los grupos a mostrar.
 * - Por visita: la más nueva primero; una visita sin detalles se ve igual (para agregarle).
 * - Por área: en orden alfabético ("Sin área" al final); dentro, del más viejo al más nuevo.
 * - Todo junto: un solo grupo, ordenado por área y luego por fecha (para recorrer la obra cuarto por cuarto).
 */
export function groupItems(inspections: readonly Inspection[], f: ItemFilters, by: GroupBy): ItemGroup[] {
  if (by === "visita") {
    return inspections
      .map((v) => ({ key: v.id, title: null, visit: v, items: v.items.filter((i) => matchesFilters(i, f)).map((i) => ({ ...i, visitedOn: v.visitedOn })) }))
      .filter((g) => g.items.length > 0 || g.visit.items.length === 0);
  }
  const items = filteredItems(inspections, f);
  if (by === "junto") {
    const sorted = [...items].sort((a, b) => {
      const aa = areaKey(a.area);
      const bb = areaKey(b.area);
      if (aa !== bb) return !aa ? 1 : !bb ? -1 : aa.localeCompare(bb, "es");
      return byVisitThenCreated(a, b);
    });
    return sorted.length ? [{ key: "all", title: null, items: sorted }] : [];
  }
  const groups = new Map<string, ItemGroup>();
  for (const i of items) {
    const key = areaKey(i.area);
    const g = groups.get(key) ?? { key: key || "-", title: i.area?.trim() || null, items: [] };
    g.items.push(i);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "es")))
    .map(([, g]) => ({ ...g, items: g.items.sort(byVisitThenCreated) }));
}

export function countItems(inspections: readonly Inspection[]): { pending: number; resolved: number } {
  let pending = 0;
  let resolved = 0;
  for (const v of inspections) {
    for (const i of v.items) {
      if (i.status === "resuelto") resolved++;
      else pending++;
    }
  }
  return { pending, resolved };
}

/** Áreas para sugerir al escribir: las ya usadas en el proyecto primero, luego las de siempre. */
export function areaSuggestions(inspections: readonly Inspection[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (a: string | null | undefined) => {
    const v = a?.trim();
    const key = normalizeSearchText(v);
    if (!v || seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  for (const v of inspections) for (const i of v.items) add(i.area);
  AREA_SUGGESTIONS.forEach(add);
  return out;
}

/** Ruta de una foto nueva en el bucket: carpeta por visita. */
export function inspectionPhotoPath(inspectionId: string, id: string = crypto.randomUUID()): string {
  return `${inspectionId}/${id}.jpg`;
}
