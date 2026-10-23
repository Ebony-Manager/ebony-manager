import type { Finish } from "@/types/cotizador";
import type { PlanAnswers, PlanPiece } from "@/types/plan";

/**
 * Reglas de medición de Ebony: convierten las piezas de un plano en los
 * renglones de la cotización. Puras y probadas contra la cotización de
 * The Woods (plan-rules.test.ts). Son las reglas que explicó la
 * cotizadora, una por una:
 *
 *  1. Módulo = el caparazón interno de cada zona con puertas o gavetas,
 *     ancho general × alto. Siempre en aglomerado (melamina), salvo
 *     detrás de puertas de vidrio, que va en el acabado externo.
 *  2. La gaveta entra DOS veces a propósito: su frente suma al m² del
 *     módulo, y además se cobra frente (acabado externo), estructura en
 *     aglomerado (ML de su ancho), un par de rieles y la apertura.
 *  3. Puertas: ancho × alto en el acabado externo, lisas o con listones.
 *     Bisagras rectas de cierre suave: 2 por hoja, 4 si la hoja pasa de
 *     1 m de alto. La puerta que abre hacia arriba lleva bisagras (2, o 4
 *     si pasa de 1 m de ancho) y además un par de brazos.
 *  4. Tablillas internas (detrás de puertas): siempre, en aglomerado,
 *     con 4 soportes por tramo. Tablillas vistas: en el acabado externo.
 *  5. Columnas y piezas verticales completas: como tablilla del acabado
 *     externo, alto × fondo, enteras (no se descuentan del módulo).
 *  6. Panelado (laterales, fondo de TV, fondo de nichos, paneles bajo
 *     gavetas): revestimiento liso del acabado externo, ancho × alto, sin
 *     descontar dilataciones.
 *  7. Piedra nunca (sobres, tablillas, tiradores), ni las referencias
 *     (TV, A/C): se dibujan pero no se cobran. Vidrio y metal sí.
 *  8. Lo que no viene en el plano sale del cuestionario: LED,
 *     estructura metálica, tipo de riel y de apertura.
 */

export interface GeneratedLine {
  /** Código del renglón en el catálogo (`quote_catalog_items.code`). */
  code: string;
  qty: number;
  /** Piezas del plano que cubre este renglón (para resaltarlas en el dibujo). */
  pieceIds: string[];
}

export interface RulesResult {
  lines: GeneratedLine[];
  /** Piezas que se dibujan pero no se cotizan, con el motivo. */
  excluded: { pieceId: string; reason: "piedra" | "referencia" }[];
}

const FINISH_CODE: Record<Finish, string> = { aglomerado: "ag", blanco: "ag", pintado: "pi", chapilla: "ch" };
const area = (p: PlanPiece) => p.w * p.h;

/** Junta en un solo renglón lo que comparte código (como en la plantilla de Excel). */
class Lines {
  private map = new Map<string, GeneratedLine>();
  add(code: string, qty: number, pieceIds: string[] = []) {
    if (qty <= 0) return;
    const cur = this.map.get(code) ?? { code, qty: 0, pieceIds: [] };
    cur.qty += qty;
    for (const id of pieceIds) if (!cur.pieceIds.includes(id)) cur.pieceIds.push(id);
    this.map.set(code, cur);
  }
  list(): GeneratedLine[] {
    // m² y ML redondeados a 2 decimales, como se escriben en la cotización.
    return [...this.map.values()].map((l) => ({ ...l, qty: Math.round((l.qty + Number.EPSILON) * 100) / 100 }));
  }
}

export function piecesToLines(pieces: PlanPiece[], a: PlanAnswers): RulesResult {
  const out = new Lines();
  const excluded: RulesResult["excluded"] = [];
  const ext = FINISH_CODE[a.exteriorFinish];
  const hasGlassDoors = pieces.some((p) => p.kind === "door" && p.material === "glass");

  for (const p of pieces) {
    if (p.kind === "reference") {
      excluded.push({ pieceId: p.id, reason: "referencia" });
      continue;
    }
    if (p.material === "stone") {
      excluded.push({ pieceId: p.id, reason: "piedra" });
      continue;
    }

    switch (p.kind) {
      case "module":
        out.add(hasGlassDoors ? `mod-${ext}` : "mod-ag", area(p), [p.id]);
        break;

      case "drawer": {
        out.add(hasGlassDoors ? `mod-${ext}` : "mod-ag", area(p), [p.id]);
        out.add(`gav-fr-${ext}`, area(p), [p.id]);
        out.add("gav-es-ag", p.w, [p.id]);
        out.add(a.slide === "blum" ? "ac-riel-b" : a.slide === "lateral" ? "ac-riel-l" : "ac-riel-e", 1, [p.id]);
        const open = p.opening ?? a.opening;
        if (open === "gola") out.add("gav-go-ag", p.w, [p.id]);
        else if (open === "push") out.add("ac-exp", 1, [p.id]);
        else if (open === "tirador" && a.pullsIncluded) out.add("ac-tir", 1, [p.id]);
        break;
      }

      case "door": {
        if (p.material === "glass") {
          out.add("sb-pvid", p.w, [p.id]);
          break;
        }
        out.add(p.slats ? `pta-${ext}-l` : `pta-${ext}`, area(p), [p.id]);
        const leaves = p.leaves?.length ? p.leaves : [p.w];
        const hinge = a.hinge === "cangrejo" ? "ac-bis-c" : "ac-bis-r";
        const open = p.opening ?? a.opening;
        if (open === "arriba") {
          out.add(hinge, (p.w > 1 ? 4 : 2) * leaves.length, [p.id]);
          out.add("ac-brazo", 2 * leaves.length, [p.id]);
        } else {
          out.add(hinge, (p.h > 1 ? 4 : 2) * leaves.length, [p.id]);
        }
        if (open === "push") out.add("ac-exp", leaves.length, [p.id]);
        else if (open === "tirador" && a.pullsIncluded) out.add("ac-tir", leaves.length, [p.id]);
        break;
      }

      case "shelf":
        if (p.material === "glass") out.add("sb-vid-10", p.w * p.d, [p.id]);
        else if (p.visible) out.add(`tab-${ext}`, p.w * p.d, [p.id]);
        else {
          out.add("tab-ag", p.w * p.d, [p.id]);
          out.add("ac-sop-tab", 4 * (p.segments ?? 1), [p.id]);
        }
        break;

      case "column":
        out.add(`tab-${ext}`, p.h * p.d, [p.id]);
        break;

      case "panel":
        out.add(p.slats ? `rev-${ext}-${p.slats >= 0.05 ? "55" : "2"}` : `rev-${ext}`, area(p), [p.id]);
        break;

      case "countertop":
        // Un sobre que no es de piedra se cobra como tablilla vista.
        out.add(`tab-${ext}`, p.w * p.d, [p.id]);
        break;
    }
  }

  out.add("sb-led", a.ledMl);
  out.add("sb-est", a.metalMl);
  return { lines: out.list(), excluded };
}

/** Descripción para el cliente, armada con las respuestas y lo excluido. */
export function planDescription(pieces: PlanPiece[], a: PlanAnswers): string {
  const finish = { pintado: "acabados en poliuretano color por definir", chapilla: "acabado en chapilla", aglomerado: "acabado en melamina" }[a.exteriorFinish];
  const parts = [
    "Fabricación e instalación según diseño, fabricado en melamina hidrófuga para interno",
    a.exteriorFinish === "aglomerado" ? "" : `MDF hidrófugo para externo con ${finish}`,
  ].filter(Boolean);
  const extras: string[] = [];
  if (pieces.some((p) => p.slats && p.kind === "door")) extras.push("listones para rejilla de ventilación");
  extras.push("herrajería cierre suave");
  if (a.opening === "gola") extras.push("sistema de apertura gola");
  if (a.opening === "push") extras.push("sistema de apertura push");
  if (a.ledMl > 0) extras.push("suministro e instalación de luz LED 3000K");
  if (a.metalMl > 0) extras.push("estructura metálica");
  if (pieces.some((p) => p.kind === "shelf" && !p.visible && p.material !== "stone")) extras.push("se contempla tablilla para interno");

  const notIncluded: string[] = [];
  const stone = pieces.filter((p) => p.material === "stone");
  if (stone.some((p) => p.kind === "countertop")) notIncluded.push("sobre de piedra");
  if (stone.some((p) => p.kind === "shelf")) notIncluded.push("tablillas de piedra");
  if (stone.some((p) => p.notes?.toLowerCase().includes("tirador"))) notIncluded.push("tiradores de piedra");
  const refs = pieces.filter((p) => p.kind === "reference");
  if (refs.some((p) => p.ref === "tv")) notIncluded.push("TV");
  if (refs.some((p) => p.ref === "ac")) notIncluded.push("aire acondicionado");

  return `${parts.join(", ")}, ${extras.join(", ")}.${notIncluded.length ? ` No incluye ${joinEs(notIncluded)}.` : ""}`;
}

function joinEs(list: string[]): string {
  return list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} ni ${list[list.length - 1]}`;
}

/**
 * Cuánto del mueble quedó cotizado: área de frente de las piezas que
 * deben cobrarse y que algún renglón cubre, sobre el total. Las piezas
 * excluidas (piedra, referencias) no cuentan.
 */
export function coverage(pieces: PlanPiece[], linePieceIds: Set<string>): { pct: number; missing: PlanPiece[] } {
  const billable = pieces.filter((p) => p.kind !== "reference" && p.material !== "stone");
  const face = (p: PlanPiece) => (p.kind === "column" ? p.h * p.d : p.kind === "shelf" || p.kind === "countertop" ? p.w * p.d : p.w * p.h);
  const total = billable.reduce((s, p) => s + face(p), 0);
  const missing = billable.filter((p) => !linePieceIds.has(p.id));
  const covered = total - missing.reduce((s, p) => s + face(p), 0);
  return { pct: total > 0 ? Math.round((covered / total) * 1000) / 10 : 100, missing };
}
