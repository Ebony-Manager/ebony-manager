import { describe, expect, it } from "vitest";

import type { CatalogItem, Quote, QuoteLine, QuoteSection } from "@/types/cotizador";
import { SEED_INPUTS, SEED_ITEMS } from "./catalog-seed";
import {
  defaultsFromInputs,
  lineQty,
  newLine,
  newSection,
  quoteTotals,
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
  it("reproduce los tres ítems de la cotización 2617", () => {
    expect(sectionTotals(panelado).total).toBeCloseTo(6397.3234, 3);
    expect(sectionTotals(listones).total).toBeCloseTo(1635.05264, 3);
    expect(sectionTotals(bar).total).toBeCloseTo(5615.244406, 3);
  });

  it("desglosa Sala / Panelado igual que la hoja", () => {
    const t = sectionTotals(panelado);
    expect(t.ebony).toBeCloseTo(2291.525, 3);
    expect(t.util).toBeCloseTo(2978.9825, 3);
    expect(t.sub).toBeCloseTo(505.71, 3);
    expect(t.subTotal).toBeCloseTo(758.565, 3);
    expect(t.waste).toBeCloseTo(37.2, 5);
    expect(t.extras).toBeCloseTo(122.2, 5);
    expect(t.ccf).toBeCloseTo(246.0509, 3);
  });

  it("un ítem sin renglones no cobra extras", () => {
    expect(sectionTotals(section("vacío", [])).total).toBe(0);
  });

  it("aplica la comisión de diseñadora antes del credit card fee", () => {
    const t = sectionTotals({ ...panelado, commissionPct: 10 });
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
  const quote = { sections: [panelado, listones, bar], discountType: "pct" as const, discountValue: 0, itbmsPct: 7 };
  it("suma los ítems y aplica el ITBMS", () => {
    const t = quoteTotals(quote);
    expect(t.subtotal).toBeCloseTo(13647.62, 2);
    expect(t.total).toBeCloseTo(13647.62 * 1.07, 1);
  });
  it("descuenta en porcentaje o en monto, antes del impuesto", () => {
    expect(quoteTotals({ ...quote, discountValue: 10 }).discount).toBeCloseTo(1364.762, 2);
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
    status: "BORRADOR",
    lang: "es",
    pdfDetail: "section",
    discountType: "pct",
    discountValue: 0,
    itbmsPct: 7,
    notes: "",
    sections: [bar],
    plans: [],
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
