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
  /** Comisión de la arquitecta (por unidad, antes de descuentos). */
  commission: number;
  base: number;
  /** Recargo de tarjeta (por unidad, antes de descuentos). Cubre también la comisión. */
  ccf: number;
  /** Lo de arriba es por unidad; `unit` es el precio de una (lo que ve el cliente, sin descuento). */
  unit: number;
  qty: number;
  /** Precio del ítem sin su descuento (unit × qty). */
  gross: number;
  /** Descuento del ítem (lo ve el cliente): el suyo o, si no tiene, el general en %. */
  discount: number;
  /** De dónde sale el descuento: el del ítem, el general (en %) o ninguno. */
  discountSource: "item" | "general" | null;
  /** El % del descuento (null si el del ítem es un monto). */
  discountPct: number | null;
  /** Precio del ítem con su descuento: gross − discount. */
  total: number;
  /** Comisión de la arquitecta en este ítem, ya con el descuento del ítem (sin el descuento general). */
  commissionAmount: number;
}

/**
 * Lo de la cotización que entra en el precio de cada ítem: comisión, recargo de tarjeta y el descuento general
 * (cuando es en %, cada ítem lo usa salvo que tenga el suyo; en monto se resta al final).
 */
export type QuoteRates = Pick<Quote, "commissionPct" | "ccfPct"> & Partial<Pick<Quote, "discountType" | "discountValue">>;

/** ¿El ítem tiene descuento propio? (si no, usa el general en %). */
export const hasOwnDiscount = (s: Pick<QuoteSection, "discountValue">) => s.discountValue > 0;

/** Cantidad del ítem (si no es un número positivo, 1). */
export function sectionQty(s: Pick<QuoteSection, "qty">): number {
  return Number.isFinite(s.qty) && s.qty > 0 ? s.qty : 1;
}

/** Los renglones que cuentan (un ítem de precio directo no tiene). */
export function pricedLines(s: Pick<QuoteSection, "priceMode" | "lines">): QuoteSection["lines"] {
  return s.priceMode === "direct" ? [] : s.lines;
}

/** Descuento sobre un monto: en % o en monto (nunca más que el monto). */
export function discountOf(amount: number, type: Quote["discountType"], value: number): number {
  if (!(value > 0) || !(amount > 0)) return 0;
  return type === "pct" ? (amount * Math.min(value, 100)) / 100 : Math.min(value, amount);
}

/**
 * Precio de un ítem.
 *   lo de Ebony (renglones × utilidad + subcontratos × margen + extras)
 * + comisión de la arquitecta (el % de la cotización; salvo ítems marcados sin comisión)
 * + recargo de tarjeta sobre todo lo anterior (también cubre la comisión)
 * − el descuento del ítem: el suyo o, si no tiene, el general cuando es en % (el del ítem REEMPLAZA al general,
 *   no se suman: 10% general y 15% en un ítem = ese ítem con 15%).
 * Como todo es proporcional, descontar el precio final equivale a descontar lo de Ebony, la comisión y la tarjeta
 * en la misma proporción: la comisión siempre sale del precio ya rebajado.
 * Un ítem de precio directo es el precio escrito, tal cual (sin comisión ni tarjeta), menos su descuento.
 */
export function sectionTotals(s: QuoteSection, rates: QuoteRates): SectionTotals {
  const qty = sectionQty(s);
  const own = hasOwnDiscount(s);
  const general = !own && rates.discountType === "pct" && (rates.discountValue ?? 0) > 0;
  const dType = own ? s.discountType : "pct";
  const dValue = own ? s.discountValue : general ? (rates.discountValue ?? 0) : 0;
  const discountSource = own ? "item" : general ? "general" : null;
  const discountPct = discountSource && dType === "pct" ? Math.min(dValue, 100) : null;
  const withDiscount = (
    t: Omit<SectionTotals, "gross" | "discount" | "discountSource" | "discountPct" | "total" | "commissionAmount">,
  ): SectionTotals => {
    const gross = t.unit * qty;
    const discount = discountOf(gross, dType, dValue);
    const total = gross - discount;
    const factor = gross > 0 ? total / gross : 0;
    return { ...t, gross, discount, discountSource, discountPct, total, commissionAmount: t.commission * qty * factor };
  };
  if (s.priceMode === "direct") {
    // Precio directo: el precio escrito, tal cual, sin utilidad ni nada encima.
    const unit = Number.isFinite(s.directPrice) && s.directPrice > 0 ? s.directPrice : 0;
    return withDiscount({ ebony: 0, util: 0, ebonyTotal: 0, sub: 0, subTotal: 0, waste: 0, extras: 0, commission: 0, base: unit, ccf: 0, unit, qty });
  }
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
  const commissionPct = s.noCommission ? 0 : rates.commissionPct || 0;
  const commission = ((ebonyTotal + subTotal + extras) * commissionPct) / 100;
  const base = ebonyTotal + subTotal + extras + commission;
  const ccf = (base * (rates.ccfPct || 0)) / 100;
  const unit = base + ccf;
  return withDiscount({ ebony, util, ebonyTotal, sub, subTotal, waste, extras, commission, base, ccf, unit, qty });
}

export interface QuoteTotals {
  /** Suma de los ítems sin descuentos. */
  gross: number;
  /** Descuentos propios de los ítems (los que tienen el suyo). */
  itemDiscounts: number;
  /** Descuento general: el % repartido en los ítems que no tienen el suyo, o el monto que se resta al final. */
  generalDiscount: number;
  /** Suma de los ítems ya con su descuento (el propio o el general en %). */
  subtotal: number;
  /** Descuento general en monto, que se resta al final (0 si el general es en %). */
  discount: number;
  net: number;
  tax: number;
  total: number;
  /** Comisión de la arquitecta: sale del precio ya con todos los descuentos. */
  commission: number;
  /** true = algún ítem tiene descuento propio: el cliente ve el descuento de cada ítem; si no, una sola línea al final. */
  itemizedDiscounts: boolean;
}

export function quoteTotals(q: Pick<Quote, "sections" | "discountType" | "discountValue" | "itbmsPct" | "commissionPct" | "ccfPct">): QuoteTotals {
  let gross = 0;
  let subtotal = 0;
  let own = 0;
  let inherited = 0;
  let itemCommission = 0;
  for (const s of q.sections) {
    const st = sectionTotals(s, q);
    gross += st.gross;
    subtotal += st.total;
    if (st.discountSource === "item") own += st.discount;
    else inherited += st.discount;
    itemCommission += st.commissionAmount;
  }
  const discount = q.discountType === "amount" ? discountOf(subtotal, "amount", q.discountValue) : 0;
  const net = subtotal - discount;
  const tax = (net * q.itbmsPct) / 100;
  const commission = subtotal > 0 ? itemCommission * (net / subtotal) : 0;
  return {
    gross,
    itemDiscounts: own,
    generalDiscount: inherited + discount,
    subtotal,
    discount,
    net,
    tax,
    total: net + tax,
    commission,
    itemizedDiscounts: q.sections.some(hasOwnDiscount),
  };
}

/**
 * Cómo ve el cliente los descuentos (PDF y vista del cliente):
 * - Si algún ítem tiene descuento propio, cada ítem muestra su descuento (debajo de su descripción) y su precio ya
 *   rebajado; al final solo va el general si es en monto.
 * - Si no, los ítems van sin descuento y el general sale en una sola línea al final, como siempre.
 */
export function clientDiscountView(q: Pick<Quote, "sections" | "discountType" | "discountValue" | "itbmsPct" | "commissionPct" | "ccfPct">) {
  const totals = quoteTotals(q);
  const itemized = totals.itemizedDiscounts;
  return {
    totals,
    itemized,
    /** El precio del ítem que se muestra. */
    itemPrice: (st: SectionTotals) => (itemized ? st.total : st.gross),
    /** ¿Se muestra el descuento debajo del ítem? */
    itemDiscount: (st: SectionTotals) => itemized && st.discount > 0.004,
    subtotal: itemized ? totals.subtotal : totals.gross,
    /** El descuento de la línea de totales (0 = no va). */
    discount: itemized ? totals.discount : totals.generalDiscount,
    /** El % para la etiqueta de esa línea (null si es en monto). */
    discountPct: !itemized && q.discountType === "pct" && q.discountValue > 0 ? q.discountValue : null,
  };
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
    validDays: v("def_valid_days", 30),
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
    terms: null,
    discountType: "pct",
    discountValue: 0,
    commissionPct: d.commissionPct,
    ccfPct: d.ccfPct,
    itbmsPct: d.itbmsPct,
    notes: "",
    sections: [newSection(firstSectionId, d)],
    opportunityId: null,
    projectId: null,
    designerId: null,
    designerContactId: null,
    clientId: null,
    validDays: Math.round(d.validDays),
    updatedAt: null,
    sentOn: null,
    closedOn: null,
    followUpOn: null,
  };
}

export function newSection(id: string, d: QuoteDefaults, location = ""): QuoteSection {
  return {
    id,
    priceMode: "recipe",
    directPrice: 0,
    location,
    name: "",
    kind: "Mueble",
    description: "",
    qty: 1,
    utilPct: d.utilPct,
    subMarginPct: d.subMarginPct,
    wasteSheets: d.wasteSheets,
    wastePct: d.wastePct,
    wasteSheetPrice: d.wasteSheetPrice,
    design3d: d.design3d,
    extraLabor: d.extraLabor,
    freight: d.freight,
    discountType: "pct",
    discountValue: 0,
    noCommission: false,
    wallShape: "recta",
    cornerAt: null,
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
