import { describe, expect, it } from "vitest";

import {
  defaultsFromInputs,
  newSection,
  quoteTotals,
} from "@/lib/cotizador/pricing";
import type { QuoteSection } from "@/types/cotizador";
import {
  alegraExpectedTotal,
  buildAlegraInvoice,
  discountPct,
} from "./invoice";

const defaults = defaultsFromInputs([]);
// Un ítem sin renglones: su precio sale de los fijos (diseño 3D, transporte…).
// El descuento general en % (10) ya está escrito en la casilla de cada ítem.
const sec = (id: string, extra: Partial<QuoteSection>): QuoteSection => ({
  ...newSection(id, defaults),
  discountValue: 10,
  lines: [],
  design3d: 100,
  extraLabor: 0,
  freight: 0,
  ...extra,
});
const config = { itemId: "15", taxId: "3", taxPct: 7 };
const quote = {
  number: "COT-2650",
  projectName: "Casa Costa del Este",
  discountType: "pct" as const,
  discountValue: 10,
  itbmsPct: 7,
  commissionPct: 0,
  ccfPct: 4,
  sections: [
    sec("a", {
      location: "Cocina",
      name: "Alacenas",
      kind: "Cocina",
      description: "MDF pintado blanco",
    }),
    sec("b", { location: "Recámara", name: "Closet", kind: "Closet", qty: 2 }),
  ],
};

describe("factura de Alegra", () => {
  it("una línea por ítem, en borrador, con descuento e ITBMS", () => {
    const body = buildAlegraInvoice(quote, config, "77", "2026-11-08");
    expect(body).toMatchObject({
      date: "2026-11-08",
      dueDate: "2026-11-08",
      client: "77",
      status: "draft",
      observations: "COT-2650 · Casa Costa del Este",
    });
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      id: "15",
      description: "Cocina · Cocina / Alacenas\nMDF pintado blanco",
      quantity: 1,
      discount: 10,
      tax: [{ id: "3" }],
    });
    expect(body.items[1]).toMatchObject({
      description: "Closet · Recámara / Closet",
      quantity: 2,
    });
    // Cuadra con el total de la cotización (a un centavo, por redondeo de precios).
    expect(
      Math.abs(alegraExpectedTotal(body, 7) - quoteTotals(quote).total),
    ).toBeLessThan(0.02);
  });

  it("un descuento en monto se reparte como % en cada línea", () => {
    const q = { ...quote, discountType: "amount" as const, discountValue: 50, sections: quote.sections.map((x) => ({ ...x, discountValue: 0 })) };
    const pct = discountPct(q);
    expect(pct).toBeCloseTo((50 / quoteTotals(q).subtotal) * 100, 3);
    const body = buildAlegraInvoice(q, config, "77", "2026-11-08");
    expect(
      Math.abs(alegraExpectedTotal(body, 7) - quoteTotals(q).total),
    ).toBeLessThan(0.02);
  });

  it("sin ITBMS no lleva impuesto; con ITBMS distinto al de Alegra, no se arma", () => {
    expect(
      buildAlegraInvoice({ ...quote, itbmsPct: 0 }, config, "77", "2026-11-08")
        .items[0].tax,
    ).toBeUndefined();
    expect(() =>
      buildAlegraInvoice(
        { ...quote, itbmsPct: 10 },
        config,
        "77",
        "2026-11-08",
      ),
    ).toThrow("no coincide");
    expect(() =>
      buildAlegraInvoice(quote, { ...config, taxId: null }, "77", "2026-11-08"),
    ).toThrow("impuesto");
  });
});

describe("factura de Alegra con descuento por ítem", () => {
  it("el descuento del ítem reemplaza al general en %, y cuadra con la cotización", () => {
    const q = { ...quote, sections: [{ ...quote.sections[0], discountType: "pct" as const, discountValue: 20 }, quote.sections[1]] };
    const body = buildAlegraInvoice(q, config, "77", "2026-11-08");
    expect(body.items[0].discount).toBeCloseTo(20, 4);
    expect(body.items[1].discount).toBeCloseTo(10, 4);
    expect(Math.abs(alegraExpectedTotal(body, 7) - quoteTotals(q).total)).toBeLessThan(0.05);
  });
});
