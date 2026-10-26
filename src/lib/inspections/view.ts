import type { Inspection, InspectionItem } from "@/types/inspections";

// Cómo se ven las inspecciones de un proyecto (y su PDF): por visita o todo
// junto, solo lo pendiente o todo. Sin React: lo usan la pantalla, el PDF y
// los tests.

/** Un detalle con la fecha de la visita a la que pertenece (para la vista "Todo junto"). */
export interface ItemWithVisit extends InspectionItem {
  visitedOn: string;
}

export const AREA_SUGGESTIONS = ["Cocina", "Closet principal", "Closet", "Walk-in closet", "Baño principal", "Baño", "Habitación principal", "Habitación", "Sala", "Comedor", "Lavandería", "Estudio", "Mueble de TV", "Entrada"];

/** Las visitas con solo los detalles a mostrar; con `onlyPending` se van las que no tienen nada pendiente. */
export function visitsToShow(inspections: readonly Inspection[], onlyPending: boolean): Inspection[] {
  if (!onlyPending) return [...inspections];
  return inspections
    .map((v) => ({ ...v, items: v.items.filter((i) => i.status === "pendiente") }))
    .filter((v) => v.items.length > 0);
}

/**
 * Todo junto: los detalles de todas las visitas en una sola lista, ordenada
 * por área (para recorrer la obra cuarto por cuarto; sin área al final) y,
 * dentro de cada área, del más viejo al más nuevo.
 */
export function allItems(inspections: readonly Inspection[], onlyPending: boolean): ItemWithVisit[] {
  const out: ItemWithVisit[] = [];
  for (const v of inspections) {
    for (const i of v.items) if (!onlyPending || i.status === "pendiente") out.push({ ...i, visitedOn: v.visitedOn });
  }
  return out.sort((a, b) => {
    const aa = a.area?.trim().toLocaleLowerCase("es") ?? "";
    const bb = b.area?.trim().toLocaleLowerCase("es") ?? "";
    if (aa !== bb) return !aa ? 1 : !bb ? -1 : aa.localeCompare(bb, "es");
    return a.visitedOn.localeCompare(b.visitedOn) || a.createdAt.localeCompare(b.createdAt);
  });
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
    if (!v || seen.has(v.toLocaleLowerCase("es"))) return;
    seen.add(v.toLocaleLowerCase("es"));
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
