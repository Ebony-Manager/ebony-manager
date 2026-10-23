import type { CatalogItem, QuoteLine, QuotePlan, QuoteSection } from "@/types/cotizador";
import type { PlanAnswers, PlanPiece } from "@/types/plan";
import { coverage, piecesToLines } from "./plan-rules";
import { newLine, round2 } from "./pricing";

/**
 * Volver a cotizar piezas de un plano después de editar el ítem a mano:
 *  - `quoteMissing` aplica las reglas solo a lo que ningún renglón cubre y
 *    lo suma al renglón del mismo ítem del catálogo (o crea uno).
 *  - `togglePiece` asigna o quita una pieza de un renglón y recalcula su
 *    metraje con las mismas reglas (una columna en "Tablilla pintada" suma
 *    alto × fondo; una puerta en "Puerta pintada", ancho × alto).
 * Puras: reciben el ítem y devuelven el ítem nuevo.
 */

/** Respuestas del cuestionario sin los extras globales (LED, metal), que no son de una pieza. */
const perPiece = (a: PlanAnswers): PlanAnswers => ({ ...a, ledMl: 0, metalMl: 0 });

export function quoteMissing(section: QuoteSection, plan: QuotePlan, catalog: CatalogItem[], newId: () => string): QuoteSection {
  const covered = new Set(section.lines.flatMap((l) => l.pieceIds));
  const { missing } = coverage(plan.pieces, covered);
  if (!missing.length) return section;
  const byCode = new Map(catalog.filter((c) => c.active).map((c) => [c.code, c]));
  const lines = [...section.lines];
  for (const g of piecesToLines(missing, perPiece(plan.answers)).lines) {
    const item = byCode.get(g.code);
    if (!item) continue;
    const i = lines.findIndex((l) => l.itemId === item.id);
    if (i >= 0) {
      const l = lines[i];
      lines[i] = { ...l, mode: "dir", qty: round2(lineQtyOf(l) + g.qty), pieceIds: [...new Set([...l.pieceIds, ...g.pieceIds])] };
    } else {
      lines.push({ ...newLine(newId(), item), mode: "dir", qty: g.qty, pieceIds: g.pieceIds });
    }
  }
  return { ...section, lines };
}

/** Lo que una pieza aporta al renglón: lo que dicen las reglas para ese código, o su área de frente. */
export function pieceQty(piece: PlanPiece, code: string | null, answers: PlanAnswers): number {
  if (code) {
    const hit = piecesToLines([piece], perPiece(answers), { round: false }).lines.find((l) => l.code === code);
    if (hit) return hit.qty;
  }
  if (piece.kind === "column") return piece.h * piece.d;
  if (piece.kind === "shelf" || piece.kind === "countertop") return piece.w * piece.d;
  return piece.w * piece.h;
}

export function togglePiece(
  section: QuoteSection,
  lineId: string,
  pieceId: string,
  plan: QuotePlan,
  catalog: CatalogItem[]
): QuoteSection {
  const byId = new Map(plan.pieces.map((p) => [p.id, p]));
  return {
    ...section,
    lines: section.lines.map((l) => {
      if (l.id !== lineId) return l;
      const pieceIds = l.pieceIds.includes(pieceId) ? l.pieceIds.filter((id) => id !== pieceId) : [...l.pieceIds, pieceId];
      const code = l.itemId ? (catalog.find((c) => c.id === l.itemId)?.code ?? null) : null;
      const qty = round2(pieceIds.reduce((s, id) => s + (byId.has(id) ? pieceQty(byId.get(id) as PlanPiece, code, plan.answers) : 0), 0));
      return { ...l, pieceIds, mode: "dir", qty };
    }),
  };
}

function lineQtyOf(l: QuoteLine): number {
  if (l.mode === "dir" || l.unit === "unidad") return l.qty || 0;
  return l.unit === "m2" ? round2(l.width * l.height * (l.pieces || 1)) : round2(l.width * (l.pieces || 1));
}
