import type { ItemStage } from "@/types/diseno";

type BlockItem = { id: string; projectId: string; area: string; stage: ItemStage; blockId: string | null; stageSince: string; sortOrder: number };

/** La clave del bloque de un ítem: en Por medir, su área; después, el bloque con el que avanzó (o él solo). */
export function blockKey(i: BlockItem): string {
  if (i.stage === "por_medir") return `area:${i.projectId}:${i.area.trim().toLocaleLowerCase("es")}`;
  return i.blockId ? `block:${i.blockId}` : `item:${i.id}`;
}

export interface Block<T> {
  key: string;
  projectId: string;
  stage: ItemStage;
  items: T[];
  /** Las áreas del bloque (sin repetir, en el orden de los ítems). */
  areas: string[];
  /** Desde cuándo está en la etapa: el ítem que lleva más tiempo. */
  since: string;
}

/** Junta los ítems en bloques (el orden: el que lleva más tiempo primero; adentro, el orden de los ítems). */
export function toBlocks<T extends BlockItem>(items: readonly T[]): Block<T>[] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const k = `${i.stage}|${blockKey(i)}`;
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return [...map.entries()]
    .map(([k, list]) => {
      const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        key: k,
        projectId: sorted[0].projectId,
        stage: sorted[0].stage,
        items: sorted,
        areas: [...new Set(sorted.map((i) => i.area.trim()).filter(Boolean))],
        since: sorted.reduce((m, i) => (i.stageSince < m ? i.stageSince : m), sorted[0].stageSince),
      };
    })
    .sort((a, b) => a.since.localeCompare(b.since));
}
