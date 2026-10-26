import {
  isSubcontract,
  type CatalogItem,
  type Finish,
  type CostInput,
  type Quote,
  type QuoteDefaults,
  type QuoteLine,
  type QuoteSection,
} from "@/types/cotizador";

/**
 * Capa de cálculo del Cotizador — pura, sin Supabase ni React. Reproduce
 * la plantilla de cotización del Excel "Cuadro de costos" (ver
 * pricing.test.ts: los tres ítems de la cotización 2617 dan al centavo).
 *
 * Total de un ítem:
 *   renglones Ebony × (1 + utilidad)
 * + subcontratos × (1 + margen de subcontratos)
 * + extras y desperdicios (lámina × láminas × desperdicio + 3D + mano de obra + flete)
 * + comisión de diseñadora sobre lo anterior
 * + credit card fee sobre todo lo anterior
 *
 * Nada se redondea en el camino (igual que la hoja); solo se redondea a
 * dos decimales el metraje de un renglón medido, y al mostrar.
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cantidad cobrada de un renglón, en su unidad (m², ML o unidades). */
export function lineQty(l: QuoteLine): number {
  if (l.mode !== "med" || l.unit === "unidad") return l.qty || 0;
  const pieces = l.pieces || 1;
  if (l.unit === "m2") return round2((l.width || 0) * (l.height || 0) * pieces);
  return round2((l.width || 0) * pieces);
}

/** Importe del renglón: lo cotizado más su gola (puertas y gavetas). */
export function lineAmount(l: QuoteLine): number {
  return lineQty(l) * (l.unitPrice || 0) + golaAmount(l);
}

export function golaAmount(l: Pick<QuoteLine, "golaMl" | "golaPrice">): number {
  return (l.golaMl || 0) * (l.golaPrice || 0);
}

const GOLA_FINISH: Record<Finish, string> = { aglomerado: "ag", blanco: "ag", pintado: "pi", chapilla: "ch" };

/** ¿Este ítem del catálogo es una gola? (se ofrece dentro de la puerta o gaveta, no como renglón). */
export const isGolaItem = (c: Pick<CatalogItem, "code">) => /^(pta|gav)-go-/.test(c.code);

/**
 * La gola que le corresponde a una puerta o gaveta según su acabado
 * (`pta-go-pi`, `gav-go-ag`…). null si el renglón no es puerta ni gaveta,
 * o si el catálogo no la tiene.
 */
export function golaItemFor(catalog: CatalogItem[], l: Pick<QuoteLine, "category" | "finish">): CatalogItem | null {
  if (l.category !== "puertas" && l.category !== "gavetas") return null;
  const code = `${l.category === "puertas" ? "pta" : "gav"}-go-${GOLA_FINISH[l.finish ?? "aglomerado"]}`;
  return catalog.find((c) => c.code === code && c.active) ?? null;
}

export interface SectionTotals {
  ebony: number;
  util: number;
  ebonyTotal: number;
  sub: number;
  subTotal: number;
  waste: number;
  extras: number;
  commission: number;
  base: number;
  ccf: number;
  total: number;
}

const ZERO: SectionTotals = { ebony: 0, util: 0, ebonyTotal: 0, sub: 0, subTotal: 0, waste: 0, extras: 0, commission: 0, base: 0, ccf: 0, total: 0 };

export function sectionTotals(s: QuoteSection): SectionTotals {
  // Un ítem sin renglones no cobra nada: los extras (desperdicio, 3D,
  // mano de obra, flete) solo aplican cuando hay algo que fabricar.
  if (s.lines.length === 0) return ZERO;
  let ebony = 0;
  let sub = 0;
  for (const l of s.lines) {
    if (isSubcontract(l.category)) sub += lineAmount(l);
    else ebony += lineAmount(l);
  }
  const util = (ebony * s.utilPct) / 100;
  const ebonyTotal = ebony + util;
  const subTotal = sub * (1 + s.subMarginPct / 100);
  const waste = (s.wasteSheetPrice * s.wasteSheets * s.wastePct) / 100;
  const extras = waste + s.design3d + s.extraLabor + s.freight;
  const commission = ((ebonyTotal + subTotal + extras) * s.commissionPct) / 100;
  const base = ebonyTotal + subTotal + extras + commission;
  const ccf = (base * s.ccfPct) / 100;
  return { ebony, util, ebonyTotal, sub, subTotal, waste, extras, commission, base, ccf, total: base + ccf };
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

export function quoteTotals(q: Pick<Quote, "sections" | "discountType" | "discountValue" | "itbmsPct">): QuoteTotals {
  const subtotal = q.sections.reduce((sum, s) => sum + sectionTotals(s).total, 0);
  const discount =
    q.discountType === "pct" ? (subtotal * (q.discountValue || 0)) / 100 : Math.min(q.discountValue || 0, subtotal);
  const net = subtotal - discount;
  const tax = (net * q.itbmsPct) / 100;
  return { subtotal, discount, net, tax, total: net + tax };
}

/** Lee los valores fijos de la empresa de la tabla de insumos. */
export function defaultsFromInputs(inputs: CostInput[]): QuoteDefaults {
  const v = (key: string, fallback: number) => inputs.find((i) => i.key === key)?.value ?? fallback;
  return {
    utilPct: v("def_util", 130),
    subMarginPct: v("def_sub_margin", 50),
    wasteSheets: v("def_waste_sheets", 1),
    wastePct: v("def_waste_pct", 30),
    wasteSheetPrice: v("lamMdf", 124),
    design3d: v("def_design3d", 30),
    extraLabor: v("def_extra_labor", 25),
    freight: v("def_freight", 30),
    commissionPct: v("def_commission", 0),
    ccfPct: v("def_ccf", 4),
    itbmsPct: v("def_itbms", 7),
    deliveryDays: v("def_delivery_days", 65),
  };
}

/**
 * Cotización en blanco, con los mismos valores con que la crearía la base
 * (borrador, español, detalle por ítem, sin descuento) más el ITBMS y los
 * días de entrega de los insumos, y un primer ítem vacío. No se guarda: el
 * editor la crea en la base recién con el primer cambio (ver QuoteEditor).
 */
export function newQuote(id: string, firstSectionId: string, d: QuoteDefaults, quoteDate: string): Quote {
  return {
    id,
    number: "",
    clientName: "",
    designerName: "",
    projectName: "",
    quoteDate,
    deliveryDays: Math.round(d.deliveryDays),
    status: "BORRADOR",
    lang: "es",
    pdfDetail: "section",
    discountType: "pct",
    discountValue: 0,
    itbmsPct: d.itbmsPct,
    notes: "",
    sections: [newSection(firstSectionId, d)],
    plans: [],
  };
}

export function newSection(id: string, d: QuoteDefaults, location = ""): QuoteSection {
  return {
    id,
    location,
    name: "",
    kind: "Mueble",
    description: "",
    utilPct: d.utilPct,
    subMarginPct: d.subMarginPct,
    wasteSheets: d.wasteSheets,
    wastePct: d.wastePct,
    wasteSheetPrice: d.wasteSheetPrice,
    design3d: d.design3d,
    extraLabor: d.extraLabor,
    freight: d.freight,
    commissionPct: d.commissionPct,
    ccfPct: d.ccfPct,
    wallShape: "recta",
    cornerAt: null,
    planId: null,
    lines: [],
  };
}

/** Medidas con las que nace un renglón según su forma (ancho, alto, piezas). */
const SHAPE_DEFAULTS: Partial<Record<CatalogItem["shape"], [number, number, number]>> = {
  rev: [2, 2.6, 1],
  rev2: [2, 2.6, 1],
  rev55: [2, 2.6, 1],
  mod: [1, 2.4, 1],
  tab: [0.96, 0.5, 4],
  gav: [0.5, 0.2, 3],
  pta: [0.5, 2.4, 2],
  ptaL: [0.5, 2.4, 2],
  esp: [0.6, 1.2, 1],
};

export function newLine(id: string, item: CatalogItem): QuoteLine {
  const def = SHAPE_DEFAULTS[item.shape];
  return {
    id,
    itemId: item.id,
    name: item.name,
    category: item.category,
    finish: item.finish,
    unit: item.unit,
    shape: item.shape,
    mode: def && item.unit !== "unidad" ? "med" : "dir",
    width: def?.[0] ?? 1,
    height: def?.[1] ?? 1,
    pieces: def?.[2] ?? 1,
    qty: 1,
    unitPrice: item.price,
    priceOverridden: false,
    wall: null,
    posX: null,
    posY: null,
    hostLineId: null,
    pieceIds: [],
    golaMl: 0,
    golaPrice: 0,
  };
}

/** Renglón libre: no está en el catálogo, nombre y precio se escriben. */
export function newFreeLine(id: string): QuoteLine {
  return {
    id,
    itemId: null,
    name: "",
    category: "libre",
    finish: null,
    unit: "unidad",
    shape: "none",
    mode: "dir",
    width: 1,
    height: 1,
    pieces: 1,
    qty: 1,
    unitPrice: 0,
    priceOverridden: true,
    wall: null,
    posX: null,
    posY: null,
    hostLineId: null,
    pieceIds: [],
    golaMl: 0,
    golaPrice: 0,
  };
}

/** Cambia el ítem de un renglón conservando sus medidas y ubicación. */
export function swapLineItem(l: QuoteLine, item: CatalogItem): QuoteLine {
  return {
    ...l,
    itemId: item.id,
    name: item.name,
    category: item.category,
    finish: item.finish,
    unit: item.unit,
    shape: item.shape,
    mode: item.unit === "unidad" ? "dir" : l.mode,
    unitPrice: item.price,
    priceOverridden: false,
  };
}

/**
 * En un borrador, los renglones sin precio ajustado siguen al catálogo:
 * si el admin cambió un precio en Costos, se refleja al abrir. Una
 * cotización ya enviada conserva los precios con los que se envió.
 */
export function syncDraftPrices(q: Quote, catalog: CatalogItem[]): Quote {
  if (q.status !== "BORRADOR") return q;
  const byId = new Map(catalog.map((c) => [c.id, c]));
  let changed = false;
  const sections = q.sections.map((s) => ({
    ...s,
    lines: s.lines.map((l) => {
      let next = l;
      const item = l.itemId ? byId.get(l.itemId) : undefined;
      if (item && !l.priceOverridden && item.price !== l.unitPrice) next = { ...next, unitPrice: item.price };
      // La gola también sigue al catálogo mientras la cotización es borrador.
      const gola = l.golaMl > 0 ? golaItemFor(catalog, l) : null;
      if (gola && gola.price !== l.golaPrice) next = { ...next, golaPrice: gola.price };
      if (next !== l) changed = true;
      return next;
    }),
  }));
  return changed ? { ...q, sections } : q;
}

export function sectionLabel(s: Pick<QuoteSection, "location" | "name">): string {
  return [s.location, s.name].filter(Boolean).join(" / ");
}

export function formatMoney(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
