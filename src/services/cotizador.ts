import "server-only";

import { createClient } from "@/lib/supabase/server";
import { selectAllRows } from "@/lib/supabase/select-all";
import { defaultsFromInputs, newSection, quoteTotals } from "@/lib/cotizador/pricing";
import type { Database, Json } from "@/types/database";
import { DEFAULT_ANSWERS, type PlanAnswers, type PlanPiece } from "@/types/plan";
import type {
  CatalogCategory,
  CatalogItem,
  CostInput,
  Finish,
  Quote,
  QuoteLine,
  QuotePlan,
  QuoteSection,
  QuoteStatus,
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
type PlanRow = Tables["quote_plans"]["Row"];

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
    pieceIds: r.piece_ids ?? [],
  };
}

function mapSection(r: SectionRow, lines: QuoteLine[]): QuoteSection {
  return {
    id: r.id,
    location: r.location,
    name: r.name,
    kind: r.kind,
    description: r.description,
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
    planId: r.plan_id,
    lines,
  };
}

function mapPlan(r: PlanRow): QuotePlan {
  const answers = r.answers && typeof r.answers === "object" && !Array.isArray(r.answers) ? (r.answers as Partial<PlanAnswers>) : {};
  return {
    id: r.id,
    fileName: r.file_name,
    filePath: r.file_path,
    source: r.source === "ejemplo" ? "ejemplo" : "ia",
    title: r.title,
    pieces: Array.isArray(r.pieces) ? (r.pieces as unknown as PlanPiece[]) : [],
    answers: { ...DEFAULT_ANSWERS, ...answers },
    doubts: Array.isArray(r.doubts) ? r.doubts.map(String) : [],
  };
}

function mapQuote(r: QuoteRow, sections: QuoteSection[], plans: QuotePlan[]): Quote {
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
    plans,
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

export async function getQuoteSummaries(): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const rows = await selectAllRows<QuoteRow>((from, to) =>
    supabase.from("quotes").select("*").order("created_at", { ascending: false }).order("id").range(from, to)
  );
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    clientName: r.client_name,
    designerName: r.designer_name,
    projectName: r.project_name,
    quoteDate: r.quote_date,
    status: r.status as QuoteStatus,
    total: num(r.total),
    updatedAt: r.updated_at,
  }));
}

export async function getQuote(id: string): Promise<Quote | null> {
  const supabase = await createClient();
  const [quoteRes, sectionRows, planRes] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    selectAllRows<SectionRow>((from, to) =>
      supabase.from("quote_sections").select("*").eq("quote_id", id).order("sort_order").order("id").range(from, to)
    ),
    supabase.from("quote_plans").select("*").eq("quote_id", id).order("created_at"),
  ]);
  if (quoteRes.error) throw new Error(quoteRes.error.message);
  if (planRes.error) throw new Error(planRes.error.message);
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
    sectionRows.map((s) => mapSection(s, bySection.get(s.id) ?? [])),
    (planRes.data ?? []).map(mapPlan)
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
    plan_id: s.planId,
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
    piece_ids: l.pieceIds ?? [],
  };
}

function headerPatch(q: Quote): Tables["quotes"]["Update"] {
  return {
    number: q.number,
    client_name: q.clientName,
    designer_name: q.designerName,
    project_name: q.projectName,
    quote_date: q.quoteDate,
    delivery_days: Math.max(0, Math.round(num(q.deliveryDays))),
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

/** Guarda la cotización completa: encabezado, ítems y renglones. */
export async function saveQuote(q: Quote): Promise<void> {
  const supabase = await createClient();
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  fail((await supabase.from("quotes").update(headerPatch(q)).eq("id", q.id)).error);

  const sectionIds = q.sections.map((s) => s.id);
  if (sectionIds.length) {
    fail((await supabase.from("quote_sections").upsert(q.sections.map((s, i) => sectionRow(q.id, s, i)))).error);
  }

  const lineIds = new Set(q.sections.flatMap((s) => s.lines.map((l) => l.id)));
  const lines = q.sections.flatMap((s) => s.lines.map((l, i) => lineRow(s.id, l, i, lineIds)));
  if (lines.length) fail((await supabase.from("quote_lines").upsert(lines)).error);

  // Borra lo que el usuario quitó. Los renglones de un ítem borrado se
  // van solos por el `on delete cascade`.
  if (sectionIds.length) {
    let staleLines = supabase.from("quote_lines").delete().in("section_id", sectionIds);
    if (lineIds.size) staleLines = staleLines.not("id", "in", `(${[...lineIds].join(",")})`);
    fail((await staleLines).error);
  }
  let staleSections = supabase.from("quote_sections").delete().eq("quote_id", q.id);
  if (sectionIds.length) staleSections = staleSections.not("id", "in", `(${sectionIds.join(",")})`);
  fail((await staleSections).error);
}

/** Crea una cotización en borrador con un primer ítem vacío. */
export async function createQuote(): Promise<string> {
  const supabase = await createClient();
  const defaults = defaultsFromInputs(await getCostInputs());
  const { data, error } = await supabase
    .from("quotes")
    .insert({ itbms_pct: defaults.itbmsPct, delivery_days: Math.round(defaults.deliveryDays) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const first = newSection(crypto.randomUUID(), defaults);
  const { error: sectionError } = await supabase.from("quote_sections").insert(sectionRow(data.id, first, 0));
  if (sectionError) throw new Error(sectionError.message);
  return data.id;
}

/** Copia una cotización como borrador nuevo (para una nueva versión). */
export async function duplicateQuote(id: string): Promise<string> {
  const source = await getQuote(id);
  if (!source) throw new Error("La cotización no existe.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").insert({}).select("id").single();
  if (error) throw new Error(error.message);

  // Los planos se copian con id nuevo y los ítems apuntan a la copia.
  const planIdMap = new Map<string, string>();
  for (const p of source.plans) {
    const { data: plan, error: planError } = await supabase
      .from("quote_plans")
      .insert({ quote_id: data.id, file_path: p.filePath, file_name: p.fileName, source: p.source, title: p.title, pieces: p.pieces as unknown as Json, answers: p.answers as unknown as Json, doubts: p.doubts })
      .select("id")
      .single();
    if (planError) throw new Error(planError.message);
    planIdMap.set(p.id, plan.id);
  }

  const lineIdMap = new Map<string, string>();
  for (const s of source.sections) for (const l of s.lines) lineIdMap.set(l.id, crypto.randomUUID());
  const copy: Quote = {
    ...source,
    id: data.id,
    number: "",
    status: "BORRADOR",
    quoteDate: new Date().toISOString().slice(0, 10),
    plans: [],
    sections: source.sections.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      planId: s.planId ? (planIdMap.get(s.planId) ?? null) : null,
      lines: s.lines.map((l) => ({
        ...l,
        id: lineIdMap.get(l.id) as string,
        hostLineId: l.hostLineId ? (lineIdMap.get(l.hostLineId) ?? null) : null,
      })),
    })),
  };
  await saveQuote(copy);
  return data.id;
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Planos ──────────────────────────────────────────────────────────────

export interface NewPlanSection {
  quoteId: string;
  plan: Omit<QuotePlan, "id">;
  section: QuoteSection;
}

/** Guarda la lectura de un plano y crea el ítem que salió de ella. */
export async function createPlanSection({ quoteId, plan, section }: NewPlanSection): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_plans")
    .insert({
      quote_id: quoteId,
      file_path: plan.filePath,
      file_name: plan.fileName,
      source: plan.source,
      title: plan.title,
      pieces: plan.pieces as unknown as Json,
      answers: plan.answers as unknown as Json,
      doubts: plan.doubts,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { count } = await supabase.from("quote_sections").select("id", { count: "exact", head: true }).eq("quote_id", quoteId);
  const withPlan = { ...section, planId: data.id };
  const { error: sectionError } = await supabase.from("quote_sections").insert(sectionRow(quoteId, withPlan, count ?? 0));
  if (sectionError) throw new Error(sectionError.message);
  const ids = new Set(section.lines.map((l) => l.id));
  if (section.lines.length) {
    const { error: lineError } = await supabase.from("quote_lines").insert(section.lines.map((l, i) => lineRow(section.id, l, i, ids)));
    if (lineError) throw new Error(lineError.message);
  }
}

/** Descarga un plano subido al bucket privado "planos". */
export async function downloadPlanFile(path: string): Promise<{ data: Buffer; mediaType: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("planos").download(path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el plano.");
  return { data: Buffer.from(await data.arrayBuffer()), mediaType: data.type || "application/pdf" };
}

/** Enlace temporal para ver el plano en la revisión. */
export async function planFileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("planos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
