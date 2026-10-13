import { describe, expect, it } from "vitest";

import { SEED_INPUTS, SEED_ITEMS } from "./catalog-seed";
import { inputValues, recipeParts } from "./recipes";

// Valores de la fila "Costo x M2 (B X H)" de la "HOJA DE CALCULO oficial"
// del Excel "Cuadro de costos" (filas 45, 88 y 132).
const OFICIAL: Record<string, number> = {
  "mod-ag": 165.0030761,
  "mod-bl": 70.66222725,
  "mod-pi": 295.9519344,
  "mod-ch": 359.7077479,
  "gav-es-ag": 57.3453463,
  "gav-es-pi": 108.6265191,
  "gav-es-ch": 139.8691858,
  "tab-ag": 50.598237,
  "tab-ag-r": 87.6989707,
  "tab-pi": 122.0900058,
  "tab-pi-r": 144.125424,
  "tab-ch": 149.1002172,
  "tab-ch-r": 182.4982688,
  "pta-ag": 61.26138434,
  "pta-ag-l": 168.1375228,
  "pta-pi": 127.2276216,
  "pta-pi-l": 150.0413956,
  "pta-ch": 162.0490502,
  "pta-ch-l": 274.7371628,
  "rev-ag": 90.48334426,
  "rev-ag-55": 211.7987213,
  "rev-ag-2": 209.5528197,
  "rev-pi": 95.49180328,
  "rev-pi-55": 129.1256831,
  "rev-pi-2": 131.0757221,
  "rev-ch": 139.4238033,
  "rev-ch-55": 268.7983497,
  "rev-ch-2": 267.7721983,
};

const ins = inputValues(SEED_INPUTS);

describe("recipeParts", () => {
  it.each(Object.entries(OFICIAL))("%s da el costo de la hoja oficial", (code, expected) => {
    const item = SEED_ITEMS.find((i) => i.code === code);
    expect(item?.recipe).toBeTruthy();
    expect(recipeParts(item!.recipe!, ins).perUnit).toBeCloseTo(expected, 4);
  });

  it("desglosa el módulo aglomerado como la hoja", () => {
    const p = recipeParts(SEED_ITEMS.find((i) => i.code === "mod-ag")!.recipe!, ins);
    expect(p.sheetPricePerM2).toBeCloseTo(40.98360656, 6);
    expect(p.material).toBeCloseTo(279.5081967, 5);
    expect(p.edge).toBeCloseTo(18.198, 6);
    expect(p.hardware).toBeCloseTo(8.931185902, 6);
    expect(p.total).toBeCloseTo(396.0073826, 5);
  });

  it("recalcula cuando cambia el precio de la lámina", () => {
    const recipe = SEED_ITEMS.find((i) => i.code === "rev-ag")!.recipe!;
    const before = recipeParts(recipe, ins).perUnit;
    const after = recipeParts(recipe, { ...ins, lamAglo: 250 }).perUnit;
    expect(after - before).toBeCloseTo(((250 - 210) / 5.124) * 1.26, 6);
  });
});
