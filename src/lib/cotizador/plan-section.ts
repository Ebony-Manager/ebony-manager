import type { CatalogItem, QuoteDefaults, QuoteSection } from "@/types/cotizador";
import type { PlanAnswers, PlanReading } from "@/types/plan";
import { isGolaItem, newLine, newSection } from "./pricing";
import { piecesToLines, planDescription } from "./plan-rules";

/**
 * Arma el ítem de la cotización a partir de un plano leído: un renglón
 * por cada código que salió de las reglas, con el precio del catálogo y
 * las piezas que cubre. Los códigos que el catálogo no tiene (o tiene
 * inactivos) se devuelven aparte para avisar, en vez de perderse.
 */
export function buildPlanSection({
  sectionId,
  newId,
  reading,
  answers,
  catalog,
  defaults,
  location,
  name,
}: {
  sectionId: string;
  newId: () => string;
  reading: PlanReading;
  answers: PlanAnswers;
  catalog: CatalogItem[];
  defaults: QuoteDefaults;
  location: string;
  name: string;
}): { section: QuoteSection; missingCodes: string[] } {
  const byCode = new Map(catalog.filter((c) => c.active).map((c) => [c.code, c]));
  const { lines } = piecesToLines(reading.pieces, answers);
  const missingCodes: string[] = [];
  const built = lines.flatMap((g) => {
    const item = byCode.get(g.code);
    if (!item) {
      missingCodes.push(g.code);
      return [];
    }
    return [{ line: { ...newLine(newId(), item), mode: "dir" as const, qty: g.qty, pieceIds: g.pieceIds }, item }];
  });
  // La gola no va como renglón suelto: se anexa a la puerta o gaveta que
  // cubre las mismas piezas (como cuando se agrega con "+ Gola").
  const merged = built.filter((b) => !isGolaItem(b.item)).map((b) => b.line);
  for (const g of built.filter((b) => isGolaItem(b.item))) {
    const target = merged.find(
      (l) => l.category === g.item.category && l.pieceIds.some((id) => g.line.pieceIds.includes(id)) && l.unit === "m2"
    );
    if (target) {
      target.golaMl = Math.round((target.golaMl + g.line.qty) * 100) / 100;
      target.golaPrice = g.item.price;
    } else merged.push(g.line);
  }
  const section: QuoteSection = {
    ...newSection(sectionId, defaults, location),
    name,
    kind: "Mueble",
    description: planDescription(reading.pieces, answers),
    lines: merged,
  };
  return { section, missingCodes };
}
