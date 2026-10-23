import { describe, expect, it } from "vitest";

import { formatQty, formatUnitCost, orderMessage, parseQty, stockStatus, suggestedOrderQty, unitLabel, variantName, whatsappNumber, whatsappUrl } from "./inventory";

describe("stockStatus", () => {
  it("sin existencia, bajo el mínimo (incluido) o bien", () => {
    expect(stockStatus({ stockQty: 0, minQty: 5 })).toBe("sin");
    expect(stockStatus({ stockQty: -2, minQty: null })).toBe("sin");
    expect(stockStatus({ stockQty: 5, minQty: 5 })).toBe("bajo");
    expect(stockStatus({ stockQty: 6, minQty: 5 })).toBe("ok");
    expect(stockStatus({ stockQty: 1, minQty: null })).toBe("ok");
  });
});

describe("suggestedOrderQty", () => {
  it("pide hasta 'pedir hasta' menos la existencia", () => {
    expect(suggestedOrderQty({ stockQty: 4, minQty: 5, reorderQty: 10 }, false)).toBe(6);
    expect(suggestedOrderQty({ stockQty: -3, minQty: 5, reorderQty: 10 }, false)).toBe(10);
  });
  it("sin 'pedir hasta' usa el doble del mínimo; redondea según la unidad", () => {
    expect(suggestedOrderQty({ stockQty: 2.5, minQty: 5, reorderQty: null }, false)).toBe(8);
    expect(suggestedOrderQty({ stockQty: 2.5, minQty: 5, reorderQty: null }, true)).toBe(7.5);
  });
});

describe("textos", () => {
  it("nombre de variante", () => {
    expect(variantName("Riel de gaveta", "40 cm · Oculto")).toBe("Riel de gaveta · 40 cm · Oculto");
    expect(variantName("High Tack", "")).toBe("High Tack");
  });
  it("cantidades y unidades", () => {
    expect(formatQty(1234.5)).toBe("1,234.5");
    expect(formatQty(12.456)).toBe("12.46");
    expect(parseQty("12,5")).toBe(12.5);
    expect(formatUnitCost(250)).toBe("$2.50");
    expect(formatUnitCost(1.5)).toBe("$0.015");
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("")).toBeNull();
    expect(unitLabel("metro", 1)).toBe("metro");
    expect(unitLabel("metro", 200)).toBe("metros");
    expect(unitLabel("galon", 2, "en")).toBe("gallons");
  });
});

describe("WhatsApp", () => {
  it("normaliza el número (8 dígitos = Panamá)", () => {
    expect(whatsappNumber("6000-1234")).toBe("50760001234");
    expect(whatsappNumber("+507 6000 1234")).toBe("50760001234");
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("123")).toBeNull();
  });
  it("arma el enlace con el mensaje", () => {
    expect(whatsappUrl("6000-1234", "Hola y chao")).toBe("https://wa.me/50760001234?text=Hola%20y%20chao");
    expect(whatsappUrl(null, "x")).toBeNull();
  });
  it("mensaje del pedido", () => {
    const msg = orderMessage("Juan", [
      { name: "Canto pintable · 0.80 x 22mm", qty: 200, unit: "metro" },
      { name: "High Tack", qty: 1, unit: "unidad" },
    ]);
    expect(msg).toContain("Hola Juan");
    expect(msg).toContain("• 200 metros — Canto pintable · 0.80 x 22mm");
    expect(msg).toContain("• 1 unidad — High Tack");
  });
});
