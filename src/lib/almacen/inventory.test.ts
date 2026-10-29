import { describe, expect, it } from "vitest";

import { formatPhonePA, formatQty, formatUnitCost, mapsUrl, orderMessage, packText, parseQty, purchasePack, roundUpToPack, stockStatus, suggestedOrderQty, unitLabel, variantName, whatsappNumber, whatsappUrl } from "./inventory";

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
  it("por presentación: rollos o galones en vez de unidades", () => {
    const msg = orderMessage(null, [{ name: "Lija · P80", qty: 56, unit: "unidad", pack: { label: "Rollo de 500 cm", qty: 28 } }]);
    expect(msg).toContain("• 2 × Rollo de 500 cm — Lija · P80");
  });
});

describe("presentación de compra", () => {
  const item = { suppliers: [{ supplierId: "s1", isPrimary: true, packLabel: "Rollo de 500 cm", packQty: 28, supplierRef: null }] };
  it("manda la de la variante; si no, la del proveedor; 1 o vacío = suelto", () => {
    expect(purchasePack(item, { packLabel: "Galón", packQty: 10 })).toEqual({ label: "Galón", qty: 10 });
    expect(purchasePack(item, { packLabel: null, packQty: null })).toEqual({ label: "Rollo de 500 cm", qty: 28 });
    expect(purchasePack(item, { packLabel: null, packQty: null }, "otro")).toBeNull();
    expect(purchasePack({ suppliers: [] }, { packLabel: "x", packQty: 1 })).toBeNull();
  });
  it("redondea a presentaciones completas", () => {
    const pack = { label: "Rollo", qty: 28 };
    expect(roundUpToPack(30, pack)).toBe(56);
    expect(roundUpToPack(28, pack)).toBe(28);
    expect(roundUpToPack(5, null)).toBe(5);
    expect(packText(56, pack)).toBe("2 × Rollo");
  });
});

describe("mapsUrl", () => {
  it("un enlace se usa tal cual; una dirección se busca en Maps; vacío es null", () => {
    expect(mapsUrl(" https://maps.app.goo.gl/abc ")).toBe("https://maps.app.goo.gl/abc");
    expect(mapsUrl("Vía España, Panamá")).toBe("https://www.google.com/maps/search/?api=1&query=V%C3%ADa%20Espa%C3%B1a%2C%20Panam%C3%A1");
    expect(mapsUrl("  ")).toBeNull();
    expect(mapsUrl(null)).toBeNull();
  });
});

describe("formatPhonePA", () => {
  it("Panamá a +507 0000-0000; otros países tal cual", () => {
    expect(formatPhonePA("62484385")).toBe("+507 6248-4385");
    expect(formatPhonePA("6248-4385")).toBe("+507 6248-4385");
    expect(formatPhonePA("+507 63211366")).toBe("+507 6321-1366");
    expect(formatPhonePA("\u202a+86 189 2283 4791\u202c")).toBe("+86 189 2283 4791");
    expect(formatPhonePA("  ")).toBeNull();
  });
});
