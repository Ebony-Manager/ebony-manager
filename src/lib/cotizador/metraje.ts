import { isSubcontract, type CatalogCategory, type Finish, type QuotePlan, type QuoteSection, type Unit } from "@/types/cotizador";
import { lineQty, round2 } from "./pricing";

/**
 * Metraje de un ítem para pedirle precio al ebanista o al pintor: cuánto
 * hay de cada acabado (pintado, aglomerado, chapilla) y de cada tipo de
 * trabajo (módulos, puertas, panelado…), sumado de los renglones. La
 * piedra no está en los renglones (Ebony no la cotiza): sale del plano.
 */

export interface MetrajeRow {
  key: string;
  qty: number;
  unit: Unit;
}

export interface Metraje {
  byFinish: MetrajeRow[];
  byWork: MetrajeRow[];
  hardware: MetrajeRow[];
  subcontracts: { name: string; qty: number; unit: Unit }[];
  /** m² de piedra del plano (sobres y tablillas), solo de referencia. */
  stoneM2: number;
}

const WORK: Partial<Record<CatalogCategory, string>> = {
  modulos: "modulos",
  puertas: "puertas",
  revestimientos: "panelado",
  tablillas: "tablillas",
  gavetas: "gavetas",
  libre: "libre",
};

export function metraje(section: QuoteSection, plan?: QuotePlan): Metraje {
  const finish = new Map<string, MetrajeRow>();
  const work = new Map<string, MetrajeRow>();
  const hardware = new Map<string, MetrajeRow>();
  const subcontracts: Metraje["subcontracts"] = [];
  const add = (map: Map<string, MetrajeRow>, key: string, qty: number, unit: Unit) => {
    const k = `${key}|${unit}`;
    const cur = map.get(k) ?? { key, qty: 0, unit };
    cur.qty += qty;
    map.set(k, cur);
  };

  for (const l of section.lines) {
    const q = lineQty(l);
    if (!q) continue;
    if (isSubcontract(l.category)) {
      subcontracts.push({ name: l.name, qty: q, unit: l.unit });
      continue;
    }
    if (l.category === "accesorios") {
      add(hardware, l.name, q, l.unit);
      continue;
    }
    const f: Finish | "sin" = l.finish ?? "sin";
    if (l.unit === "m2") add(finish, f === "blanco" ? "aglomerado" : f, q, "m2");
    // Las gavetas llevan frente (m²) y estructura/gola (ML): lo lineal va
    // con su propio nombre para no sumar estructura con gola.
    add(work, l.category === "gavetas" && l.unit !== "m2" ? l.name : (WORK[l.category] ?? l.category), q, l.unit);
    if (l.golaMl > 0) add(work, "gola", l.golaMl, "ml");
  }

  const stoneM2 = plan
    ? plan.pieces.filter((p) => p.material === "stone" && p.kind !== "reference").reduce((s, p) => s + p.w * p.d, 0)
    : 0;
  const done = (m: Map<string, MetrajeRow>) => [...m.values()].map((r) => ({ ...r, qty: round2(r.qty) })).sort((a, b) => b.qty - a.qty);
  return { byFinish: done(finish), byWork: done(work), hardware: done(hardware), subcontracts, stoneM2: round2(stoneM2) };
}
