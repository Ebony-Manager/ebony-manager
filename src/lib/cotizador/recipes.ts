import type { Recipe } from "@/types/cotizador";

/**
 * Cómo se llega al costo de un renglón — la "HOJA DE CALCULO oficial" del
 * Excel "Cuadro de costos". Pura: recibe la receta y los insumos (precio
 * de láminas, canteo, pintura) y devuelve cada parte del desglose.
 *
 *   material   = precio de la lámina / superficie de la lámina × m² usable
 *   canteo     = ML de canteo × precio del canteo
 *   pintura    = Σ m² × precio de pintura
 *   tornillería= % sobre (material + canteo) o (material + pintura)
 *   total      = material + canteo + pintura + mano de obra + tornillería + fijo
 *   por unidad = total / m² de la pieza de referencia
 */
export interface RecipeParts {
  sheetArea: number;
  sheetPricePerM2: number;
  material: number;
  edge: number;
  paint: number;
  hardware: number;
  total: number;
  perUnit: number;
}

export type InputValues = Record<string, number>;

export function recipeParts(r: Recipe | Omit<Recipe, "itemId">, ins: InputValues): RecipeParts {
  const v = (k: string) => ins[k] ?? 0;
  // La lámina blanca viene en otro formato (2.75 × 1.85); el resto usa el
  // tamaño estándar de lámina.
  const sheetArea = r.sheetKey === "lamBlanco" ? v("lamBlancoArea") : v("lamW") * v("lamH");
  const sheetPricePerM2 = sheetArea > 0 ? v(r.sheetKey) / sheetArea : 0;
  const material = sheetPricePerM2 * r.usableM2;
  const edge = r.edgeMl * v(r.edgeKey);
  const paint = r.paint.reduce((sum, [m2, key]) => sum + m2 * v(key), 0);
  const hardware = (material + (r.hardwareBase === "paint" ? paint : edge)) * r.hardwarePct;
  const total = material + edge + paint + r.labor + hardware + r.fixed;
  return { sheetArea, sheetPricePerM2, material, edge, paint, hardware, total, perUnit: r.baseM2 > 0 ? total / r.baseM2 : total };
}

export function inputValues(inputs: { key: string; value: number }[]): InputValues {
  return Object.fromEntries(inputs.map((i) => [i.key, i.value]));
}
