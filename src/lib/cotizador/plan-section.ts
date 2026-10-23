import type { CatalogItem, QuoteDefaults, QuoteSection } from "@/types/cotizador";
import type { PlanAnswers, PlanReading } from "@/types/plan";
import { newLine, newSection } from "./pricing";
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
  const section: QuoteSection = {
    ...newSection(sectionId, defaults, location),
    name,
    kind: "Mueble",
    description: planDescription(reading.pieces, answers),
    lines: lines.flatMap((g) => {
      const item = byCode.get(g.code);
      if (!item) {
        missingCodes.push(g.code);
        return [];
      }
      return [{ ...newLine(newId(), item), mode: "dir" as const, qty: g.qty, pieceIds: g.pieceIds }];
    }),
  };
  return { section, missingCodes };
}
