import type { QuoteSection } from "@/types/cotizador";
import { sectionTotals } from "./pricing";

/**
 * La lista de ítems de una cotización: agrupada por ubicación ("Rec #8" →
 * MF-15, MF-16…), para que con 50 ítems se encuentre todo. Sin React.
 */

/** "REC  #8 " y "Rec #8" son la misma ubicación. */
export function locationKey(location: string): string {
  return location
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface LocationGroup {
  key: string;
  /** Como se escribió la primera vez ("" = sin ubicación). */
  label: string;
  sections: QuoteSection[];
  total: number;
}

/** Grupos en el orden en que aparece cada ubicación; los ítems, en su orden. */
export function locationGroups(sections: readonly QuoteSection[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  for (const s of sections) {
    const key = locationKey(s.location);
    const g = groups.get(key) ?? { key, label: s.location.trim(), sections: [], total: 0 };
    g.sections.push(s);
    g.total += sectionTotals(s).total;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** El orden en que se ven (agrupados): así se guarda, y los de una ubicación quedan juntos. */
export function groupedOrder(sections: readonly QuoteSection[]): QuoteSection[] {
  return locationGroups(sections).flatMap((g) => g.sections);
}

/** Las ubicaciones ya usadas, para ofrecerlas al escribir (una por ubicación). */
export function locationSuggestions(sections: readonly QuoteSection[]): string[] {
  return locationGroups(sections)
    .map((g) => g.label)
    .filter(Boolean);
}

/**
 * Mueve un ítem antes de otro (o al final con `beforeId` null). Si se suelta
 * dentro de otra ubicación, toma esa ubicación (escrita igual que el grupo).
 */
export function moveSection(sections: readonly QuoteSection[], id: string, beforeId: string | null): QuoteSection[] {
  const ordered = groupedOrder(sections);
  const moving = ordered.find((s) => s.id === id);
  if (!moving || id === beforeId) return ordered;
  const rest = ordered.filter((s) => s.id !== id);
  const target = beforeId ? rest.find((s) => s.id === beforeId) : rest[rest.length - 1];
  const moved = target && locationKey(target.location) !== locationKey(moving.location) ? { ...moving, location: target.location } : moving;
  const at = beforeId ? rest.findIndex((s) => s.id === beforeId) : rest.length;
  const next = [...rest];
  next.splice(at < 0 ? rest.length : at, 0, moved);
  return groupedOrder(next);
}

/** Sube (-1) o baja (+1) un ítem dentro de su ubicación. */
export function shiftSection(sections: readonly QuoteSection[], id: string, delta: -1 | 1): QuoteSection[] {
  const ordered = groupedOrder(sections);
  const group = locationGroups(ordered).find((g) => g.sections.some((s) => s.id === id));
  if (!group) return ordered;
  const i = group.sections.findIndex((s) => s.id === id);
  const j = i + delta;
  if (j < 0 || j >= group.sections.length) return ordered;
  const swapped = [...group.sections];
  [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
  return locationGroups(ordered).flatMap((g) => (g.key === group.key ? swapped : g.sections));
}

/** Copia de un ítem (ids nuevos), justo después del original. */
export function duplicateSection(sections: readonly QuoteSection[], id: string, newId: () => string): { sections: QuoteSection[]; copyId: string | null } {
  const ordered = groupedOrder(sections);
  const i = ordered.findIndex((s) => s.id === id);
  if (i < 0) return { sections: ordered, copyId: null };
  const src = ordered[i];
  const ids = new Map(src.lines.map((l) => [l.id, newId()]));
  const copy: QuoteSection = {
    ...src,
    id: newId(),
    lines: src.lines.map((l) => ({ ...l, id: ids.get(l.id) as string, hostLineId: l.hostLineId ? (ids.get(l.hostLineId) ?? null) : null })),
  };
  const next = [...ordered];
  next.splice(i + 1, 0, copy);
  return { sections: next, copyId: copy.id };
}
