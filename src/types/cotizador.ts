/**
 * Tipos de dominio del Cotizador (camelCase) — separados de
 * `src/types/database.ts` igual que en Planilla y Contratistas: el
 * servicio mapea de las filas snake_case a estos, y la capa de cálculo
 * (`src/lib/cotizador/`) trabaja solo con estos.
 *
 * Estructura: Cotización → Ítems (lo que en el Excel era cada hoja
 * repetida: "Sala / Panelado", "Sala / Bar") → Renglones (los del
 * catálogo: módulos, gavetas, revestimientos, subcontratos…).
 *
 * Dinero: los precios unitarios del catálogo traen más de dos decimales
 * (48.4581 por ML) porque salen de la hoja de cálculo; guardarlos en
 * centavos cambiaría los totales respecto al Excel. Por eso acá es
 * `number` en dólares (numeric en Postgres), no centavos enteros.
 */

import type { PlanAnswers, PlanPiece } from "@/types/plan";

export type Unit = "m2" | "ml" | "unidad";
export type Finish = "aglomerado" | "blanco" | "pintado" | "chapilla";

/** Cómo se dibuja el renglón en el visor 3D. `none` = no se dibuja. */
export type Shape = "none" | "mod" | "gav" | "tab" | "pta" | "ptaL" | "rev" | "rev2" | "rev55" | "esp" | "vid" | "led";

export const EBONY_CATEGORIES = ["modulos", "gavetas", "tablillas", "puertas", "revestimientos", "accesorios", "libre"] as const;
export const SUB_CATEGORIES = ["espejos", "vidrios", "metales", "tapiceria", "iluminacion"] as const;
export type CatalogCategory = (typeof EBONY_CATEGORIES)[number] | (typeof SUB_CATEGORIES)[number];

export function isSubcontract(category: CatalogCategory): boolean {
  return (SUB_CATEGORIES as readonly string[]).includes(category);
}

export interface CatalogItem {
  id: string;
  code: string;
  category: CatalogCategory;
  finish: Finish | null;
  name: string;
  unit: Unit;
  /** Precio "para cotizar" (costo por unidad, antes de utilidad). */
  price: number;
  shape: Shape;
  active: boolean;
  sortOrder: number;
}

/** Receta de la "HOJA DE CALCULO oficial": cómo se llega al costo. */
export interface Recipe {
  itemId: string;
  sheetKey: string;
  usableM2: number;
  edgeMl: number;
  edgeKey: string;
  /** Pares [m², clave del insumo de pintura]. */
  paint: [number, string][];
  labor: number;
  hardwarePct: number;
  /** La tornillería se calcula sobre material + canteo, o material + pintura. */
  hardwareBase: "edge" | "paint";
  fixed: number;
  fixedLabel: string | null;
  /** m² de la pieza de referencia sobre la que se divide el costo. */
  baseM2: number;
}

export type CostInputKind = "insumo" | "default";
export interface CostInput {
  key: string;
  kind: CostInputKind;
  label: string;
  value: number;
  unit: string;
  sortOrder: number;
}

/** Valores fijos de la empresa con los que nace cada ítem nuevo. */
export interface QuoteDefaults {
  utilPct: number;
  subMarginPct: number;
  wasteSheets: number;
  wastePct: number;
  wasteSheetPrice: number;
  design3d: number;
  extraLabor: number;
  freight: number;
  commissionPct: number;
  ccfPct: number;
  itbmsPct: number;
  deliveryDays: number;
}

export type LineMode = "med" | "dir";
export type Wall = "A" | "B";

export interface QuoteLine {
  id: string;
  /** null en un renglón libre o si el ítem del catálogo se borró. */
  itemId: string | null;
  name: string;
  category: CatalogCategory;
  finish: Finish | null;
  unit: Unit;
  shape: Shape;
  /** `med` = ancho × alto × piezas; `dir` = cantidad escrita directo. */
  mode: LineMode;
  width: number;
  height: number;
  pieces: number;
  qty: number;
  unitPrice: number;
  /** true = precio ajustado solo para esta cotización. */
  priceOverridden: boolean;
  /** Ubicación en el dibujo 3D; null = acomodo automático. */
  wall: Wall | null;
  posX: number | null;
  posY: number | null;
  hostLineId: string | null;
  /** Piezas del plano que cubre (solo en ítems generados desde un plano). */
  pieceIds: string[];
}

export type WallShape = "recta" | "L";
export const SECTION_KINDS = ["Revestimiento", "Mueble", "Closet", "Cocina", "Cama", "Otro"] as const;

export interface QuoteSection {
  id: string;
  location: string;
  name: string;
  kind: string;
  description: string;
  utilPct: number;
  subMarginPct: number;
  wasteSheets: number;
  wastePct: number;
  wasteSheetPrice: number;
  design3d: number;
  extraLabor: number;
  freight: number;
  commissionPct: number;
  ccfPct: number;
  wallShape: WallShape;
  cornerAt: number | null;
  /** Plano del que se generó el ítem; con plano, el dibujo sale exacto de sus piezas. */
  planId: string | null;
  lines: QuoteLine[];
}

export type QuoteStatus = "BORRADOR" | "ENVIADA" | "APROBADA" | "RECHAZADA";
export const QUOTE_STATUSES: QuoteStatus[] = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA"];
export type DiscountType = "pct" | "amount";
export type PdfDetail = "section" | "line" | "total";

export interface Quote {
  id: string;
  number: string;
  clientName: string;
  designerName: string;
  projectName: string;
  quoteDate: string;
  deliveryDays: number;
  status: QuoteStatus;
  lang: "es" | "en";
  pdfDetail: PdfDetail;
  discountType: DiscountType;
  discountValue: number;
  itbmsPct: number;
  notes: string;
  sections: QuoteSection[];
  /** Planos leídos en esta cotización. */
  plans: QuotePlan[];
}

export interface QuotePlan {
  id: string;
  fileName: string;
  filePath: string | null;
  source: "ia" | "ejemplo";
  title: string;
  pieces: PlanPiece[];
  answers: PlanAnswers;
  doubts: string[];
}

/** Fila de la lista de cotizaciones (sin ítems ni renglones). */
export interface QuoteSummary {
  id: string;
  number: string;
  clientName: string;
  designerName: string;
  projectName: string;
  quoteDate: string;
  status: QuoteStatus;
  total: number;
  updatedAt: string;
}
