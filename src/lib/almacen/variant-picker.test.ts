import { describe, expect, it } from "vitest";

import { dimensionCount, optionsAt, reconcile, resolveVariant, selectionOf } from "./variant-picker";

const riel = [
  { id: "a", label: "30 cm · Cierre suave · Oculto" },
  { id: "b", label: "35 cm · Cierre suave · Oculto" },
  { id: "c", label: "35 cm · Push · Oculto" },
  { id: "d", label: "40 cm · Cierre suave · Lateral" },
  { id: "e", label: "40 cm · Cierre suave · Oculto" },
];

describe("dimensionCount", () => {
  it("cuenta los menús según las etiquetas", () => {
    expect(dimensionCount(riel)).toBe(3);
    expect(dimensionCount([{ id: "x", label: "" }])).toBe(0);
    expect(dimensionCount([{ id: "x", label: "Negro" }, { id: "y", label: "Plateado" }])).toBe(1);
    // Etiquetas disparejas: un solo menú con la etiqueta completa.
    expect(dimensionCount([{ id: "x", label: "C · Negro" }, { id: "y", label: "Tapa" }])).toBe(1);
  });
});

describe("menús encadenados", () => {
  it("cada menú ofrece solo lo que existe con lo elegido antes", () => {
    expect(optionsAt(riel, 0, [])).toEqual(["30 cm", "35 cm", "40 cm"]);
    expect(optionsAt(riel, 1, ["35 cm"])).toEqual(["Cierre suave", "Push"]);
    expect(optionsAt(riel, 2, ["40 cm", "Cierre suave"])).toEqual(["Lateral", "Oculto"]);
  });

  it("al cambiar un menú, los siguientes se acomodan a algo que exista", () => {
    expect(reconcile(riel, ["30 cm", "Push", "Lateral"])).toEqual(["30 cm", "Cierre suave", "Oculto"]);
    expect(reconcile(riel, ["40 cm", "Cierre suave", "Lateral"])).toEqual(["40 cm", "Cierre suave", "Lateral"]);
  });

  it("encuentra la variante elegida", () => {
    expect(resolveVariant(riel, ["35 cm", "Push", "Oculto"])?.id).toBe("c");
    expect(resolveVariant(riel, ["35 cm", "Push", "Lateral"])).toBeNull();
    expect(resolveVariant([{ id: "u", label: "" }], [])?.id).toBe("u");
    expect(selectionOf(riel, riel[3])).toEqual(["40 cm", "Cierre suave", "Lateral"]);
  });
});
