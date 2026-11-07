import "server-only";

import { createClient } from "@/lib/supabase/server";
import { selectAllRows } from "@/lib/supabase/select-all";
import { quoteTotals } from "@/lib/cotizador/pricing";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import type { Database, Json } from "@/types/database";
import { MAX_ITEM_IMAGES } from "@/types/cotizador";
import type {
  CatalogCategory,
  CatalogItem,
  CostInput,
  Finish,
  Quote,
  QuoteLine,
  QuoteOwnerOptions,
  QuoteImage,
  QuoteSection,
  QuoteSibling,
  QuoteStatus,
  QuoteStatusResult,
  QuoteSummary,
  Recipe,
  Shape,
  Unit,
} from "@/types/cotizador";

/**
 * Capa de datos del Cotizador (tablas `quote_*`). Los totales NUNCA se
 * calculan acá: salen de `src/lib/cotizador/pricing.ts`; `quotes.total`
 * es solo la copia que muestra la lista.
 *
 * Guardado: el editor trabaja sobre la cotización completa en memoria y
 * la manda entera (`saveQuote`). Los ids de ítems y renglones se generan
 * en el navegador, así que guardar es un upsert por id más el borrado de
 * lo que ya no está.
 */

type Tables = Database["public"]["Tables"];
type CatalogRow = Tables["quote_catalog_items"]["Row"];
type InputRow = Tables["quote_cost_inputs"]["Row"];
type RecipeRow = Tables["quote_item_recipes"]["Row"];
type QuoteRow = Tables["quotes"]["Row"];
type SectionRow = Tables["quote_sections"]["Row"];
type LineRow = Tables["quote_lines"]["Row"];

/** `numeric` puede volver como string por PostgREST — se normaliza. */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: number | string | null | undefined): number | null {
  return v === null || v === undefined ? null : num(v);
}

function mapCatalog(r: CatalogRow): CatalogItem {
  return {
    id: r.id,
    code: r.code,
    category: r.category as CatalogCategory,
    finish: r.finish as Finish | null,
    name: r.name,
    unit: r.unit as Unit,
    price: num(r.price),
    shape: r.shape as Shape,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

function mapInput(r: InputRow): CostInput {
  return { key: r.key, kind: r.kind === "default" ? "default" : "insumo", label: r.label, value: num(r.value), unit: r.unit, sortOrder: r.sort_order };
}

function mapRecipe(r: RecipeRow): Recipe {
  const paint = Array.isArray(r.paint)
    ? (r.paint as Json[]).flatMap((p): [number, string][] =>
        Array.isArray(p) && p.length === 2 ? [[num(p[0] as number | string), String(p[1])]] : []
      )
    : [];
  return {
    itemId: r.item_id,
    sheetKey: r.sheet_key,
    usableM2: num(r.usable_m2),
    edgeMl: num(r.edge_ml),
    edgeKey: r.edge_key,
    paint,
    labor: num(r.labor),
    hardwarePct: num(r.hardware_pct),
    hardwareBase: r.hardware_base === "paint" ? "paint" : "edge",
    fixed: num(r.fixed),
    fixedLabel: r.fixed_label,
    baseM2: num(r.base_m2) || 1,
  };
}

function mapLine(r: LineRow): QuoteLine {
  return {
    id: r.id,
    itemId: r.item_id,
    name: r.name,
    category: r.category as CatalogCategory,
    finish: r.finish as Finish | null,
    unit: r.unit as Unit,
    shape: r.shape as Shape,
    mode: r.mode === "med" ? "med" : "dir",
    width: num(r.width),
    height: num(r.height),
    pieces: num(r.pieces),
    qty: num(r.qty),
    unitPrice: num(r.unit_price),
    priceOverridden: r.price_overridden,
    wall: r.wall === "A" || r.wall === "B" ? r.wall : null,
    posX: numOrNull(r.pos_x),
    posY: numOrNull(r.pos_y),
    hostLineId: r.host_line_id,
    golaMl: num(r.gola_ml),
    golaPrice: num(r.gola_price),
  };
}

function mapSection(r: SectionRow, lines: QuoteLine[]): QuoteSection {
  return {
    id: r.id,
    location: r.location,
    name: r.name,
    kind: r.kind,
    description: r.description,
    // Antes de la migración de cantidad la columna no existe: 1.
    qty: num(r.qty) || 1,
    utilPct: num(r.util_pct),
    subMarginPct: num(r.sub_margin_pct),
    wasteSheets: num(r.waste_sheets),
    wastePct: num(r.waste_pct),
    wasteSheetPrice: num(r.waste_sheet_price),
    design3d: num(r.design_3d),
    extraLabor: num(r.extra_labor),
    freight: num(r.freight),
    commissionPct: num(r.commission_pct),
    ccfPct: num(r.ccf_pct),
    wallShape: r.wall_shape === "L" ? "L" : "recta",
    cornerAt: numOrNull(r.corner_at),
    lines,
  };
}

function mapQuote(r: QuoteRow, sections: QuoteSection[]): Quote {
  return {
    id: r.id,
    number: r.number,
    clientName: r.client_name,
    designerName: r.designer_name,
    projectName: r.project_name,
    quoteDate: r.quote_date,
    deliveryDays: r.delivery_days,
    status: r.status as QuoteStatus,
    lang: r.lang === "en" ? "en" : "es",
    pdfDetail: r.pdf_detail === "line" || r.pdf_detail === "total" ? r.pdf_detail : "section",
    discountType: r.discount_type === "amount" ? "amount" : "pct",
    discountValue: num(r.discount_value),
    itbmsPct: num(r.itbms_pct),
    notes: r.notes,
    sections,
    opportunityId: r.opportunity_id,
    projectId: r.project_id,
    designerId: r.designer_id,
    designerContactId: r.designer_contact_id,
    clientId: r.client_id,
    validDays: r.valid_days,
    updatedAt: r.updated_at,
    sentOn: r.sent_on,
    closedOn: r.closed_on,
    followUpOn: r.follow_up_on,
  };
}

// ── Catálogo, insumos y recetas ─────────────────────────────────────────

export async function getCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const rows = await selectAllRows<CatalogRow>((from, to) =>
    supabase.from("quote_catalog_items").select("*").order("sort_order").order("id").range(from, to)
  );
  return rows.map(mapCatalog);
}

export async function getCostInputs(): Promise<CostInput[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quote_cost_inputs").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInput);
}

/** Solo-admin por RLS: a un vendedor le vuelve vacío. */
export async function getRecipes(): Promise<Recipe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quote_item_recipes").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRecipe);
}

export async function updateCatalogItem(
  id: string,
  patch: { price?: number; active?: boolean; name?: string }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_catalog_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface CreateCatalogItemInput {
  name: string;
  category: CatalogCategory;
  finish: Finish | null;
  unit: Unit;
  price: number;
  shape: Shape;
}

export async function createCatalogItem(input: CreateCatalogItemInput): Promise<CatalogItem> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("quote_catalog_items")
    .select("sort_order")
    .eq("category", input.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("quote_catalog_items")
    .insert({
      // El código es solo un identificador legible y único; no se muestra.
      code: `x-${crypto.randomUUID().slice(0, 8)}`,
      name: input.name,
      category: input.category,
      finish: input.finish,
      unit: input.unit,
      price: input.price,
      shape: input.shape,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCatalog(data);
}

export async function updateCostInput(key: string, value: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_cost_inputs").update({ value }).eq("key", key);
  if (error) throw new Error(error.message);
}

// ── Cotizaciones ────────────────────────────────────────────────────────

function mapSummary(r: QuoteRow): QuoteSummary {
  return {
    id: r.id,
    number: r.number,
    clientName: r.client_name,
    designerName: r.designer_name,
    projectName: r.project_name,
    quoteDate: r.quote_date,
    status: r.status as QuoteStatus,
    total: num(r.total),
    updatedAt: r.updated_at,
    followUpOn: r.status === "ENVIADA" ? r.follow_up_on : null,
    opportunityId: r.opportunity_id,
    projectId: r.project_id,
    designerId: r.designer_id,
    clientId: r.client_id,
  };
}

export async function getQuoteSummaries(): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const rows = await selectAllRows<QuoteRow>((from, to) =>
    supabase.from("quotes").select("*").order("created_at", { ascending: false }).order("id").range(from, to)
  );
  return rows.map(mapSummary);
}

/** Las cotizaciones de un proyecto: las aprobadas que lo crearon y sus adicionales. */
export async function getProjectQuotes(projectId: string): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSummary);
}

export async function getQuote(id: string): Promise<Quote | null> {
  const supabase = await createClient();
  const [quoteRes, sectionRows] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    selectAllRows<SectionRow>((from, to) =>
      supabase.from("quote_sections").select("*").eq("quote_id", id).order("sort_order").order("id").range(from, to)
    ),
  ]);
  if (quoteRes.error) throw new Error(quoteRes.error.message);
  if (!quoteRes.data) return null;

  const sectionIds = sectionRows.map((s) => s.id);
  const lineRows = sectionIds.length
    ? await selectAllRows<LineRow>((from, to) =>
        supabase.from("quote_lines").select("*").in("section_id", sectionIds).order("sort_order").order("id").range(from, to)
      )
    : [];
  const bySection = new Map<string, QuoteLine[]>();
  for (const r of lineRows) {
    const list = bySection.get(r.section_id) ?? [];
    list.push(mapLine(r));
    bySection.set(r.section_id, list);
  }
  return mapQuote(
    quoteRes.data,
    sectionRows.map((s) => mapSection(s, bySection.get(s.id) ?? []))
  );
}

function sectionRow(quoteId: string, s: QuoteSection, i: number): Tables["quote_sections"]["Insert"] {
  return {
    id: s.id,
    quote_id: quoteId,
    sort_order: i,
    location: s.location,
    name: s.name,
    kind: s.kind,
    description: s.description,
    qty: num(s.qty) > 0 ? num(s.qty) : 1,
    util_pct: num(s.utilPct),
    sub_margin_pct: num(s.subMarginPct),
    waste_sheets: num(s.wasteSheets),
    waste_pct: num(s.wastePct),
    waste_sheet_price: num(s.wasteSheetPrice),
    design_3d: num(s.design3d),
    extra_labor: num(s.extraLabor),
    freight: num(s.freight),
    commission_pct: num(s.commissionPct),
    ccf_pct: num(s.ccfPct),
    wall_shape: s.wallShape === "L" ? "L" : "recta",
    corner_at: s.cornerAt === null ? null : num(s.cornerAt),
  };
}

function lineRow(sectionId: string, l: QuoteLine, i: number, lineIds: Set<string>): Tables["quote_lines"]["Insert"] {
  return {
    id: l.id,
    section_id: sectionId,
    sort_order: i,
    item_id: l.itemId,
    name: l.name,
    category: l.category,
    finish: l.finish,
    unit: l.unit,
    shape: l.shape,
    mode: l.mode,
    width: num(l.width),
    height: num(l.height),
    pieces: num(l.pieces) || 1,
    qty: num(l.qty),
    unit_price: num(l.unitPrice),
    price_overridden: l.priceOverridden,
    wall: l.wall,
    pos_x: l.posX === null ? null : num(l.posX),
    pos_y: l.posY === null ? null : num(l.posY),
    // Un anfitrión que ya no existe en la cotización rompería el FK.
    host_line_id: l.hostLineId && lineIds.has(l.hostLineId) ? l.hostLineId : null,
    gola_ml: num(l.golaMl),
    gola_price: num(l.golaPrice),
  };
}

/** El encabezado como lo guarda `save_quote` (el número lo pone la base). */
function headerRow(q: Quote) {
  return {
    id: q.id,
    client_name: q.clientName,
    designer_name: q.designerName,
    project_name: q.projectName,
    designer_id: q.designerId,
    designer_contact_id: q.designerContactId,
    client_id: q.clientId,
    opportunity_id: q.opportunityId,
    project_id: q.projectId,
    quote_date: q.quoteDate,
    delivery_days: Math.max(0, Math.round(num(q.deliveryDays))),
    valid_days: Math.max(0, Math.round(num(q.validDays))),
    status: q.status,
    lang: q.lang,
    pdf_detail: q.pdfDetail,
    discount_type: q.discountType,
    discount_value: num(q.discountValue),
    itbms_pct: num(q.itbmsPct),
    notes: q.notes,
    total: Math.round(quoteTotals(q).total * 100) / 100,
  };
}

/** Mensaje con que falla un guardado cuando otra persona guardó antes. */
export const QUOTE_CONFLICT = "CONFLICTO";

/**
 * Guarda la cotización completa (encabezado, ítems y renglones) en una sola
 * llamada que es todo o nada. `expected` es el updated_at que tenía el
 * editor: si otra persona guardó después, no se pisa nada y falla con
 * QUOTE_CONFLICT. Devuelve el updated_at nuevo.
 */
export async function saveQuote(q: Quote, expected: string | null): Promise<string> {
  const supabase = await createClient();
  const lineIds = new Set(q.sections.flatMap((s) => s.lines.map((l) => l.id)));
  const { data, error } = await supabase.rpc("save_quote", {
    p_quote: headerRow(q) as unknown as Json,
    p_sections: q.sections.map((s, i) => sectionRow(q.id, s, i)) as unknown as Json,
    p_lines: q.sections.flatMap((s) => s.lines.map((l, i) => lineRow(s.id, l, i, lineIds))) as unknown as Json,
    p_expected: expected,
  });
  if (error) throw new Error(error.message.includes(QUOTE_CONFLICT) ? QUOTE_CONFLICT : error.message);
  return data;
}

/**
 * Crea en la base una cotización que hasta ahora solo existía en el editor
 * (ver `newQuote`): el editor la llama con el primer cambio del usuario, así
 * abrir "Nueva cotización" y salir sin escribir nada no deja un borrador
 * vacío. El id lo trae la cotización (uuid generado al abrirla).
 */
export async function createQuote(q: Quote): Promise<{ number: string; updatedAt: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").insert({ id: q.id }).select("number").single();
  if (error) throw new Error(error.message);
  const updatedAt = await saveQuote(q, null);
  // Empezar a cotizar una oportunidad de Seguimiento la pasa a "Cotizando".
  if (q.opportunityId) {
    await supabase.from("sales_opportunities").update({ stage: "cotizando" }).eq("id", q.opportunityId).eq("stage", "por_cotizar");
  }
  return { number: data.number, updatedAt };
}

/**
 * Nueva versión de una cotización: mismo número con -V2, -V3… (ej. la misma
 * cocina en melamina y en pintado), mismo dueño, como borrador de hoy.
 */
export async function duplicateQuote(id: string): Promise<string> {
  const source = await getQuote(id);
  if (!source) throw new Error("La cotización no existe.");
  const supabase = await createClient();
  const { data: base, error: baseError } = await supabase.from("quotes").select("base_number").eq("id", id).single();
  if (baseError) throw new Error(baseError.message);
  const baseNumber = base.base_number;
  let version = 1;
  if (baseNumber !== null) {
    const { data: last } = await supabase.from("quotes").select("version").eq("base_number", baseNumber).order("version", { ascending: false }).limit(1).maybeSingle();
    version = (last?.version ?? 1) + 1;
  }
  const { data, error } = await supabase
    .from("quotes")
    .insert(baseNumber !== null ? { base_number: baseNumber, version } : {})
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const lineIdMap = new Map<string, string>();
  for (const s of source.sections) for (const l of s.lines) lineIdMap.set(l.id, crypto.randomUUID());
  const copy: Quote = {
    ...source,
    id: data.id,
    status: "BORRADOR",
    quoteDate: todayInPanama(),
    sections: source.sections.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      lines: s.lines.map((l) => ({
        ...l,
        id: lineIdMap.get(l.id) as string,
        hostLineId: l.hostLineId ? (lineIdMap.get(l.hostLineId) ?? null) : null,
      })),
    })),
  };
  await saveQuote(copy, null);
  // Las imágenes pasan con sus ítems (el mismo archivo, sin volver a subirlo).
  const sectionMap = new Map(source.sections.map((s, i) => [s.id, copy.sections[i].id]));
  const images = await getQuoteImages(id);
  if (images.length) {
    const { error: imgError } = await supabase
      .from("quote_section_images")
      .insert(images.map((im) => ({ section_id: sectionMap.get(im.sectionId) as string, path: im.path, sort_order: im.sortOrder })));
    if (imgError) throw new Error(imgError.message);
  }
  return data.id;
}

/** Oportunidades abiertas y proyectos, para elegir de quién es la cotización. */
export async function getQuoteOwnerOptions(): Promise<QuoteOwnerOptions> {
  const supabase = await createClient();
  const [opps, projects] = await Promise.all([
    supabase.from("sales_opportunities").select("id, title, location, stage, designer_id, designer_contact_id, client_id").order("received_on", { ascending: false }),
    supabase.rpc("quote_projects"),
  ]);
  if (opps.error) throw new Error(opps.error.message);
  return {
    opportunities: (opps.data ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      location: o.location,
      stage: o.stage,
      designerId: o.designer_id,
      designerContactId: o.designer_contact_id,
      clientId: o.client_id,
    })),
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status, designerId: p.designer_id, clientId: p.client_id })),
  };
}

export interface SetQuoteStatusInput {
  lostReason?: string | null;
  lostNote?: string | null;
  /** Al aprobar una de oportunidad: proyecto nuevo (nombre) o uno que ya existe. */
  projectName?: string | null;
  projectId?: string | null;
  /** Al aprobar una de oportunidad: otras de la misma oportunidad que el cliente también aprobó. */
  also?: string[];
}

/** Cambia el estado con sus reglas (ver set_quote_status en la base). */
export async function setQuoteStatus(id: string, status: QuoteStatus, input: SetQuoteStatusInput = {}): Promise<QuoteStatusResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_quote_status", {
    p_id: id,
    p_status: status,
    p_lost_reason: input.lostReason ?? null,
    p_lost_note: input.lostNote ?? null,
    p_project_name: input.projectName ?? null,
    p_project_id: input.projectId ?? null,
    p_also: input.also ?? null,
  });
  if (error) throw new Error(error.message);
  const { data, error: readError } = await supabase.from("quotes").select("status, sent_on, closed_on, follow_up_on, project_id, updated_at").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  return {
    status: data.status as QuoteStatus,
    sentOn: data.sent_on,
    closedOn: data.closed_on,
    followUpOn: data.follow_up_on,
    projectId: data.project_id,
    updatedAt: data.updated_at,
  };
}

/** Las otras versiones del mismo número y las otras cotizaciones de la misma oportunidad. */
export async function getQuoteSiblings(id: string): Promise<QuoteSibling[]> {
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("base_number, opportunity_id").eq("id", id).maybeSingle();
  if (!q) return [];
  const filters = [q.base_number !== null ? `base_number.eq.${q.base_number}` : null, q.opportunity_id ? `opportunity_id.eq.${q.opportunity_id}` : null].filter(Boolean);
  if (!filters.length) return [];
  const { data, error } = await supabase.from("quotes").select("id, number, status, total, base_number, version, opportunity_id").or(filters.join(",")).neq("id", id).order("base_number").order("version");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, number: r.number, opportunityId: r.opportunity_id, status: r.status as QuoteStatus, total: num(r.total) }));
}

// ── Imágenes de los ítems ───────────────────────────────────────────────

export const QUOTE_IMAGES_BUCKET = "quote-images";

/** Las imágenes de una cotización, por ítem y en su orden. */
export async function getQuoteImages(quoteId: string): Promise<QuoteImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_section_images")
    .select("id, section_id, path, sort_order, quote_sections!inner(quote_id)")
    .eq("quote_sections.quote_id", quoteId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, sectionId: r.section_id, path: r.path, sortOrder: r.sort_order }));
}

/** Registra una imagen ya subida al bucket (la sube el navegador). */
export async function addQuoteImage(sectionId: string, path: string): Promise<QuoteImage> {
  const supabase = await createClient();
  const { count } = await supabase.from("quote_section_images").select("id", { count: "exact", head: true }).eq("section_id", sectionId);
  if ((count ?? 0) >= MAX_ITEM_IMAGES) throw new Error(`Máximo ${MAX_ITEM_IMAGES} imágenes por ítem.`);
  const { data, error } = await supabase
    .from("quote_section_images")
    .insert({ section_id: sectionId, path, sort_order: count ?? 0 })
    .select("id, section_id, path, sort_order")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, sectionId: data.section_id, path: data.path, sortOrder: data.sort_order };
}

/** "Duplicar ítem": la copia lleva las mismas imágenes (el mismo archivo, sin volver a subirlo). */
export async function copySectionImages(fromSectionId: string, toSectionId: string): Promise<QuoteImage[]> {
  const supabase = await createClient();
  const { data: source, error } = await supabase.from("quote_section_images").select("path, sort_order").eq("section_id", fromSectionId).order("sort_order");
  if (error) throw new Error(error.message);
  if (!source?.length) return [];
  const { data, error: insertError } = await supabase
    .from("quote_section_images")
    .insert(source.slice(0, MAX_ITEM_IMAGES).map((im) => ({ section_id: toSectionId, path: im.path, sort_order: im.sort_order })))
    .select("id, section_id, path, sort_order");
  if (insertError) throw new Error(insertError.message);
  return (data ?? []).map((r) => ({ id: r.id, sectionId: r.section_id, path: r.path, sortOrder: r.sort_order }));
}

/** Quita una imagen; el archivo se borra si ninguna otra cotización (versión) lo usa. */
export async function deleteQuoteImage(id: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quote_section_images").delete().eq("id", id).select("path").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const { count } = await supabase.from("quote_section_images").select("id", { count: "exact", head: true }).eq("path", data.path);
  if (!count) await supabase.storage.from(QUOTE_IMAGES_BUCKET).remove([data.path]);
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
