import { describe, expect, it } from "vitest";

import type { CatalogItem, Quote, QuoteLine, QuoteSection } from "@/types/cotizador";
import { SEED_INPUTS, SEED_ITEMS } from "./catalog-seed";
import {
  golaItemFor,
  isGolaItem,
  lineAmount,
  defaultsFromInputs,
  lineQty,
  newLine,
  newQuote,
  newSection,
  quoteTotals,
  applyGeneralDiscount,
  clientDiscountView,
  pricedLines,
  sectionTotals,
  swapLineItem,
  syncDraftPrices,
} from "./pricing";
import { buildScene } from "./scene";

// Cotización 2617 (Alessandra Arellano — Proyecto Pacific Point): los
// montos de cada ítem salen de la hoja "Arq. Alessandra Arellano" del
// Excel "Cuadro de costos" y son los que aparecen en el PDF enviado.

const catalog: CatalogItem[] = SEED_ITEMS.map((s) => ({
  id: s.code,
  code: s.code,
  category: s.category,
  finish: s.finish,
  name: s.name,
  unit: s.unit,
  price: s.price,
  shape: s.shape,
  active: true,
  sortOrder: s.sortOrder,
}));
const item = (code: string) => {
  const found = catalog.find((c) => c.code === code);
  if (!found) throw new Error(`no existe ${code}`);
  return found;
};
const defaults = defaultsFromInputs(SEED_INPUTS.map((i) => ({ ...i })));

let seq = 0;
function med(code: string, width: number, height: number, pieces: number, price?: number): QuoteLine {
  const l = { ...newLine(`l${++seq}`, item(code)), mode: "med" as const, width, height, pieces };
  return price === undefined ? l : { ...l, unitPrice: price, priceOverridden: true };
}
function dir(code: string, qty: number, price?: number): QuoteLine {
  const l = { ...newLine(`l${++seq}`, item(code)), mode: "dir" as const, qty };
  return price === undefined ? l : { ...l, unitPrice: price, priceOverridden: true };
}
// Los valores de la empresa: sin comisión y 4% de tarjeta (como la cotización 2617).
const rates = { commissionPct: defaults.commissionPct, ccfPct: defaults.ccfPct };

function section(name: string, lines: QuoteLine[]): QuoteSection {
  return { ...newSection(name, defaults, "Sala"), name, lines };
}

const panelado = section("Panelado", [med("rev-pi", 4.19, 2, 1), med("rev-pi-2", 2.06, 3.5, 1), med("sb-esp-g", 0.7, 1.5, 1), dir("sb-led", 5.28)]);
const listones = section("Panelado listones", [med("rev-ag-2", 1.264, 2.5, 1, 199.5)]);
const bar = section("Bar", [
  med("mod-ag", 1.45, 0.8, 1, 135.97),
  med("mod-pi", 1.25, 1.6, 1),
  med("gav-es-ag", 1.39, 0, 3, 48.45810404371585),
  med("gav-go-ag", 1.39, 0, 3),
  med("gav-fr-pi", 0.725, 0.4, 4, 95.49180327868852),
  dir("ac-riel-e", 6),
  med("rev-pi", 1.5, 2.54, 1),
  med("rev-pi-2", 0.5, 2.44, 1),
  dir("sb-vid-10", 0.97),
  dir("sb-sesc", 1, 80),
  dir("sb-est", 1, 80),
  dir("sb-led", 4.56),
]);

describe("sectionTotals", () => {
  it("precio directo: el precio escrito × cantidad, sin utilidad ni renglones", () => {
    const direct = { ...panelado, priceMode: "direct" as const, directPrice: 450, qty: 2 };
    const st = sectionTotals(direct, rates);
    expect(st).toMatchObject({ unit: 450, qty: 2, total: 900, util: 0, ebony: 0, sub: 0 });
    expect(pricedLines(direct)).toEqual([]);
    expect(pricedLines(panelado).length).toBe(panelado.lines.length);
  });

  it("reproduce los tres ítems de la cotización 2617", () => {
    expect(sectionTotals(panelado, rates).total).toBeCloseTo(6397.3234, 3);
    expect(sectionTotals(listones, rates).total).toBeCloseTo(1635.05264, 3);
    expect(sectionTotals(bar, rates).total).toBeCloseTo(5615.244406, 3);
  });

  it("desglosa Sala / Panelado igual que la hoja", () => {
    const t = sectionTotals(panelado, rates);
    expect(t.ebony).toBeCloseTo(2291.525, 3);
    expect(t.util).toBeCloseTo(2978.9825, 3);
    expect(t.sub).toBeCloseTo(505.71, 3);
    expect(t.subTotal).toBeCloseTo(758.565, 3);
    expect(t.waste).toBeCloseTo(37.2, 5);
    expect(t.extras).toBeCloseTo(122.2, 5);
    expect(t.ccf).toBeCloseTo(246.0509, 3);
  });

  it("aplica la comisión de diseñadora antes del credit card fee (la tarjeta también cubre la comisión)", () => {
    const t = sectionTotals(panelado, { ...rates, commissionPct: 10 });
    const before = t.ebonyTotal + t.subTotal + t.extras;
    expect(t.commission).toBeCloseTo(before * 0.1, 6);
    expect(t.total).toBeCloseTo(before * 1.1 * 1.04, 6);
  });
});

describe("lineQty", () => {
  it("multiplica ancho × alto × piezas en m² y largo × piezas en ML", () => {
    expect(lineQty(med("rev-pi", 4.19, 2, 1))).toBe(8.38);
    expect(lineQty(med("gav-es-ag", 1.39, 0, 3))).toBe(4.17);
    expect(lineQty(med("gav-fr-pi", 0.725, 0.4, 4))).toBe(1.16);
  });
  it("usa la cantidad directa en modo directo y en unidades", () => {
    expect(lineQty(dir("sb-led", 5.28))).toBe(5.28);
    expect(lineQty(dir("ac-riel-e", 6))).toBe(6);
  });
});

describe("quoteTotals", () => {
  const quote = { sections: [panelado, listones, bar], discountType: "pct" as const, discountValue: 0, itbmsPct: 7, ...rates };
  it("suma los ítems y aplica el ITBMS", () => {
    const t = quoteTotals(quote);
    expect(t.subtotal).toBeCloseTo(13647.62, 2);
    expect(t.total).toBeCloseTo(13647.62 * 1.07, 1);
  });
  it("descuenta en porcentaje o en monto, antes del impuesto", () => {
    // El general en % se escribe en las casillas de los ítems.
    const pct = quoteTotals({ ...quote, discountValue: 10, sections: quote.sections.map((x) => ({ ...x, discountValue: 10 })) });
    expect(pct.allDiscounts).toBeCloseTo(1364.762, 2);
    expect(pct.net).toBeCloseTo(13647.62 - 1364.762, 2);
    expect(pct.uniformPct).toBe(10);
    const t = quoteTotals({ ...quote, discountType: "amount", discountValue: 647.62 });
    expect(t.net).toBeCloseTo(13000, 2);
    expect(t.tax).toBeCloseTo(910, 2);
  });
  it("nunca descuenta más que el subtotal", () => {
    expect(quoteTotals({ ...quote, discountType: "amount", discountValue: 999999 }).net).toBe(0);
  });
});

describe("precios y catálogo", () => {
  const base: Quote = {
    id: "q",
    number: "2617",
    clientName: "",
    designerName: "",
    projectName: "",
    quoteDate: "2026-10-12",
    deliveryDays: 65,
    commissionPct: 0,
    ccfPct: 4,
    validDays: 30,
    status: "BORRADOR",
    lang: "es",
    pdfDetail: "section",
    terms: null,
    discountType: "pct",
    discountValue: 0,
    itbmsPct: 7,
    notes: "",
    sections: [bar],
    opportunityId: null, projectId: null, designerId: null, designerContactId: null, clientId: null, updatedAt: null, sentOn: null, closedOn: null, followUpOn: null,
  };
  const raised = catalog.map((c) => (c.code === "mod-pi" ? { ...c, price: 300 } : c));

  it("un borrador sigue al catálogo salvo en los renglones con precio ajustado", () => {
    const synced = syncDraftPrices(base, raised);
    expect(synced.sections[0].lines[1].unitPrice).toBe(300);
    expect(synced.sections[0].lines[0].unitPrice).toBe(135.97);
  });
  it("una cotización enviada conserva sus precios", () => {
    const sent = { ...base, status: "ENVIADA" as const };
    expect(syncDraftPrices(sent, raised)).toBe(sent);
  });
  it("cambiar de ítem conserva las medidas y toma el precio del catálogo", () => {
    const l = swapLineItem(med("rev-pi", 2, 3, 1, 999), item("rev-ch"));
    expect(l.unitPrice).toBe(184.3);
    expect(l.priceOverridden).toBe(false);
    expect(lineQty(l)).toBe(6);
  });
});

describe("buildScene", () => {
  it("apila el módulo alto sobre el bajo y monta gavetas y tablillas", () => {
    const scene = buildScene(bar);
    const [low, high] = scene.groups.filter((g) => g.isModule);
    expect(low.y).toBe(0);
    expect(high.y).toBeCloseTo(0.8, 6);
    expect(low.children.map((c) => c.lineId)).toContain(bar.lines[4].id);
    expect(high.children.some((c) => c.boxes.some((b) => b.mat.kind === "glass"))).toBe(true);
  });
  it("respeta la posición arrastrada y la pared B en esquina", () => {
    const moved = { ...bar, wallShape: "L" as const, cornerAt: 2, lines: bar.lines.map((l, i) => (i === 6 ? { ...l, wall: "B" as const, posX: 0.5, posY: 0 } : l)) };
    const g = buildScene(moved).groups.find((x) => x.lineId === bar.lines[6].id);
    expect(g?.wall).toBe("B");
    expect(g?.along).toBe(0.5);
  });
  it("avisa cuando un renglón en m² no tiene medidas", () => {
    expect(buildScene(panelado).approximate).toBe(false);
    expect(buildScene(section("x", [dir("rev-pi", 8.38)])).approximate).toBe(true);
  });
});

describe("newQuote", () => {
  it("nace en borrador, vacía, con un ítem y los valores de los insumos", () => {
    const q = newQuote("q1", "s1", defaults, "2026-10-20");
    expect(q).toMatchObject({
      id: "q1",
      number: "",
      clientName: "",
      status: "BORRADOR",
      quoteDate: "2026-10-20",
      itbmsPct: defaults.itbmsPct,
      deliveryDays: Math.round(defaults.deliveryDays),
      discountValue: 0,
    });
    expect(q.sections).toHaveLength(1);
    expect(q.sections[0]).toMatchObject({ id: "s1", lines: [] });
  });
});

describe("gola dentro de puertas y gavetas", () => {
  const golas: CatalogItem[] = [
    { id: "pta-go-pi", code: "pta-go-pi", category: "puertas", finish: "pintado", name: "Gola para puertas pintadas", unit: "ml", price: 16.93, shape: "none", active: true, sortOrder: 256 },
    { id: "pta-go-ag", code: "pta-go-ag", category: "puertas", finish: "aglomerado", name: "Gola para puertas aglomeradas", unit: "ml", price: 11.2, shape: "none", active: true, sortOrder: 255 },
  ];
  const all = [...catalog, ...golas];

  it("elige la gola según la categoría y el acabado", () => {
    expect(golaItemFor(all, item("pta-pi"))?.code).toBe("pta-go-pi");
    expect(golaItemFor(all, item("gav-fr-ag"))?.code).toBe("gav-go-ag");
    expect(golaItemFor(all, item("rev-pi"))).toBeNull();
    expect(isGolaItem(item("gav-go-pi"))).toBe(true);
    expect(isGolaItem(item("gav-fr-pi"))).toBe(false);
  });

  it("suma la gola al importe del renglón y al costo Ebony", () => {
    const door = { ...med("pta-pi", 0.9, 0.72, 1), golaMl: 0.9, golaPrice: 16.93 };
    expect(lineAmount(door)).toBeCloseTo(0.65 * 127.23 + 0.9 * 16.93, 6);
    const s = section("puerta", [door]);
    expect(sectionTotals(s, rates).ebony).toBeCloseTo(lineAmount(door), 6);
  });

  it("en un borrador la gola sigue el precio del catálogo", () => {
    const door = { ...med("pta-pi", 0.9, 0.72, 1), golaMl: 0.9, golaPrice: 15 };
    const q = { id: "q", number: "", clientName: "", designerName: "", projectName: "", quoteDate: "2026-10-26", deliveryDays: 65, status: "BORRADOR" as const, lang: "es" as const, pdfDetail: "section" as const, terms: null, discountType: "pct" as const, discountValue: 0, ...rates, itbmsPct: 7, notes: "", sections: [section("x", [door])], validDays: 30, opportunityId: null, projectId: null, designerId: null, designerContactId: null, clientId: null, updatedAt: null, sentOn: null, closedOn: null, followUpOn: null };
    expect(syncDraftPrices(q, all).sections[0].lines[0].golaPrice).toBe(16.93);
  });
});

describe("cantidad por ítem", () => {
  it("el total del ítem es el de una unidad por la cantidad", () => {
    const s = { ...newSection("s", defaults), lines: [], design3d: 30, extraLabor: 0, freight: 0, wasteSheets: 0 };
    const noFee = { ...rates, ccfPct: 0 };
    const one = sectionTotals(s, noFee);
    const three = sectionTotals({ ...s, qty: 3 }, noFee);
    expect(three.unit).toBeCloseTo(one.total, 6);
    expect(three.total).toBeCloseTo(one.total * 3, 6);
    expect(sectionTotals({ ...s, qty: 0 }, noFee).total).toBeCloseTo(one.total, 6);
  });
});

describe("descuento por ítem y comisión de la cotización", () => {
  const s = { ...newSection("s", defaults), lines: [], design3d: 1000, extraLabor: 0, freight: 0, wasteSheets: 0 };
  const r = { commissionPct: 10, ccfPct: 4 };

  it("la comisión va dentro del precio y la tarjeta también la cubre", () => {
    const t = sectionTotals(s, r);
    expect(t.commission).toBeCloseTo(100, 6);
    expect(t.total).toBeCloseTo(1000 * 1.1 * 1.04, 6);
    expect(t.commissionAmount).toBeCloseTo(100, 6);
  });

  it("el descuento del ítem baja el precio y la comisión en la misma proporción", () => {
    const t = sectionTotals({ ...s, discountType: "pct", discountValue: 10 }, r);
    expect(t.gross).toBeCloseTo(1144, 6);
    expect(t.discount).toBeCloseTo(114.4, 6);
    expect(t.total).toBeCloseTo(1029.6, 6);
    expect(t.commissionAmount).toBeCloseTo(90, 6);
    const amount = sectionTotals({ ...s, discountType: "amount", discountValue: 5000 }, r);
    expect(amount.total).toBe(0);
  });

  it("un ítem marcado sin comisión no la lleva", () => {
    const t = sectionTotals({ ...s, noCommission: true }, r);
    expect(t.commission).toBe(0);
    expect(t.total).toBeCloseTo(1040, 6);
  });

  it("la comisión sale del subtotal con el descuento general (ej. de Carlos: 1,000 − 10% = 900 → comisión 90)", () => {
    const q = { sections: [{ ...s, discountValue: 10 }], discountType: "pct" as const, discountValue: 10, itbmsPct: 7, commissionPct: 10, ccfPct: 0 };
    const t = quoteTotals(q);
    expect(t.gross).toBeCloseTo(1100, 6);
    expect(t.allDiscounts).toBeCloseTo(110, 6);
    expect(t.net).toBeCloseTo(990, 6);
    expect(t.commission).toBeCloseTo(90, 6);
  });

  it("suma los descuentos de los ítems aparte del general", () => {
    const q = { sections: [{ ...s, discountType: "pct" as const, discountValue: 10 }, s], discountType: "pct" as const, discountValue: 0, itbmsPct: 7, ...r };
    const t = quoteTotals(q);
    expect(t.gross).toBeCloseTo(2288, 6);
    expect(t.itemDiscounts).toBeCloseTo(114.4, 6);
    expect(t.subtotal).toBeCloseTo(2173.6, 6);
    expect(t.commission).toBeCloseTo(190, 6);
  });
});

describe("descuento general en % y descuento propio del ítem", () => {
  const s = { ...newSection("s", defaults), lines: [], design3d: 1000, extraLabor: 0, freight: 0, wasteSheets: 0 };
  const quote = { ...newQuote("q", "a", defaults, "2026-11-20"), commissionPct: 0, ccfPct: 0, itbmsPct: 0, sections: [{ ...s, id: "a" }, { ...s, id: "b" }] };

  it("el general en % llena las casillas; cambiar uno a mano lo respeta (no se suman)", () => {
    let q = applyGeneralDiscount(quote, { discountType: "pct", discountValue: 10 });
    expect(q.sections.map((x) => x.discountValue)).toEqual([10, 10]);
    q = { ...q, sections: [q.sections[0], { ...q.sections[1], discountValue: 15 }] };
    q = applyGeneralDiscount(q, { discountType: "pct", discountValue: 12 });
    expect(q.sections.map((x) => x.discountValue)).toEqual([12, 15]);
    const t = quoteTotals(q);
    expect(t.net).toBeCloseTo(880 + 850, 6);
    expect(t.uniformPct).toBeNull();
    expect(clientDiscountView(q)).toMatchObject({ subtotal: 2000, discountPct: null });
    expect(clientDiscountView(q).discount).toBeCloseTo(270, 6);
  });

  it("todos con el mismo %: una sola línea con el %, sin detalle en los ítems", () => {
    const q = applyGeneralDiscount(quote, { discountType: "pct", discountValue: 10 });
    const v = clientDiscountView(q);
    expect(v.discountPct).toBe(10);
    expect(v.itemDiscount(sectionTotals(q.sections[0], q))).toBe(false);
  });

  it("pasar a monto quita el % de las casillas y lo resta al final", () => {
    let q = applyGeneralDiscount(quote, { discountType: "pct", discountValue: 10 });
    q = applyGeneralDiscount(q, { discountType: "amount", discountValue: 100 });
    expect(q.sections.map((x) => x.discountValue)).toEqual([0, 0]);
    const t = quoteTotals(q);
    expect(t.discount).toBeCloseTo(100, 6);
    expect(t.net).toBeCloseTo(1900, 6);
  });
});
