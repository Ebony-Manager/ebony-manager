import { describe, expect, it } from "vitest";
import { laborAmountCents, laborTotals, orderMissing } from "./missing";

describe("orderMissing", () => {
  it("pide ítems, los 4 documentos y la mano de obra", () => {
    expect(orderMissing({ itemCount: 0, fileKinds: [], laborCount: 0 })).toEqual(["items", "hoja_ruta", "despiece", "optimizacion", "cotizacion_proveedor", "mano_obra"]);
  });
  it("no pide la hoja de electricidad", () => {
    expect(orderMissing({ itemCount: 2, fileKinds: ["hoja_ruta", "despiece", "optimizacion", "cotizacion_proveedor"], laborCount: 3 })).toEqual([]);
  });
  it("con varios archivos del mismo tipo cuenta uno", () => {
    expect(orderMissing({ itemCount: 1, fileKinds: ["despiece", "despiece", "hoja_ruta", "optimizacion"], laborCount: 1 })).toEqual(["cotizacion_proveedor"]);
  });
});

describe("mano de obra", () => {
  it("calcula cantidad × tarifa y suma por contratista", () => {
    expect(laborAmountCents({ quantity: 2.5, unitPriceCents: 7600 })).toBe(19000);
    const t = laborTotals([
      { contractorType: "ebanista", quantity: 2.5, unitPriceCents: 7600 },
      { contractorType: "ebanista", quantity: 1, unitPriceCents: 3400 },
      { contractorType: "pintor", quantity: 3, unitPriceCents: 4700 },
    ]);
    expect(t.get("ebanista")).toBe(22400);
    expect(t.get("pintor")).toBe(14100);
  });
});
