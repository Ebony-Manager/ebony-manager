import { describe, expect, it } from "vitest";

import { answerText, parseProductLine, productLines } from "./jotform-egresos";

describe("parseProductLine", () => {
  it("separa producto, variantes y cantidad", () => {
    expect(parseProductLine("Riel de Gaveta (Amount: 0.00 USD, Quantity: 2, Tamaño: 30cm, Apertura: Push)")).toEqual({
      product: "Riel de Gaveta",
      variant: "Tamaño: 30cm · Apertura: Push",
      quantity: 2,
    });
  });

  it("acepta 'Cantidad' y decimales", () => {
    expect(parseProductLine("Canto Pintable (Amount: 0.00 USD, Cantidad: 12.5, : 0.80 x 22mm)")).toEqual({
      product: "Canto Pintable",
      variant: "0.80 x 22mm",
      quantity: 12.5,
    });
  });

  it("no confunde un paréntesis del nombre con los detalles", () => {
    expect(parseProductLine("Caja Cinta LED 3000K (Amarilla) (Amount: 0.00 USD, Quantity: 3)")).toEqual({
      product: "Caja Cinta LED 3000K (Amarilla)",
      variant: "",
      quantity: 3,
    });
    expect(parseProductLine("Caja Cinta LED 3000K (Amarilla)")).toEqual({ product: "Caja Cinta LED 3000K (Amarilla)", variant: "", quantity: 1 });
  });

  it("conserva las comas dentro de un valor sin clave", () => {
    expect(parseProductLine('Tornillos Pared (Amount: 0.00 USD, Quantity: 50, Tamaño: 8 x 2" 1/4)').variant).toBe('Tamaño: 8 x 2" 1/4');
  });
});

describe("productLines", () => {
  it("usa paymentArray cuando existe", () => {
    const answer = { answer: { paymentArray: JSON.stringify({ product: ["A (Amount: 0 USD, Quantity: 1)", "B (Amount: 0 USD, Quantity: 2)"] }) } };
    expect(productLines(answer)).toHaveLength(2);
  });

  it("cae a prettyFormat y descarta el total", () => {
    expect(productLines({ prettyFormat: "A (Quantity: 1)<br>B (Quantity: 2)<br>Total: 0.00 USD" })).toEqual(["A (Quantity: 1)", "B (Quantity: 2)"]);
  });
});

describe("answerText", () => {
  it("formatea fechas", () => {
    expect(answerText({ answer: { year: "2026", month: "9", day: "3" } })).toBe("2026-09-03");
  });
});
