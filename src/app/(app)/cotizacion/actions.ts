"use server";

import { requireModule } from "@/lib/auth/dal";
import * as cotizador from "@/services/cotizador";
import { PlanReadError, readPlan } from "@/services/plan-reader";
import type { Quote } from "@/types/cotizador";
import type { PlanReading } from "@/types/plan";

// Cotizar pide el módulo `cotizacion`; el catálogo y los insumos solo los
// cambia quien tiene `costos` (el admin, los dos). La RLS de las tablas
// `quote_*` repite las dos reglas como última línea.
//
// Sin `revalidatePath`: el editor es optimista (la pantalla ya muestra lo
// que se guardó) y las páginas son `force-dynamic`, así que la lista
// vuelve a leer sola al entrar.

/** Primer guardado de una cotización nueva (hasta ahí solo vivía en el editor). */
export async function createQuoteAction(quote: Quote): Promise<void> {
  await requireModule("cotizacion");
  await cotizador.createQuote(quote);
}

export async function saveQuoteAction(quote: Quote): Promise<void> {
  await requireModule("cotizacion");
  await cotizador.saveQuote(quote);
}

export async function duplicateQuoteAction(id: string): Promise<string> {
  await requireModule("cotizacion");
  return cotizador.duplicateQuote(id);
}

export async function deleteQuoteAction(id: string): Promise<void> {
  await requireModule("cotizacion");
  await cotizador.deleteQuote(id);
}

export async function updateCatalogItemAction(id: string, patch: { price?: number; active?: boolean; name?: string }) {
  await requireModule("costos");
  await cotizador.updateCatalogItem(id, patch);
}

export async function createCatalogItemAction(input: cotizador.CreateCatalogItemInput) {
  await requireModule("costos");
  return cotizador.createCatalogItem(input);
}

export async function updateCostInputAction(key: string, value: number) {
  await requireModule("costos");
  await cotizador.updateCostInput(key, value);
}

// ── Planos ──────────────────────────────────────────────────────────────

/**
 * Lee un plano ya subido al bucket "planos". Devuelve el error como valor
 * (no lo lanza) para que el mensaje llegue tal cual a la pantalla: en
 * producción Next oculta el texto de los errores lanzados por un action.
 */
export async function readPlanAction(path: string, fileName: string): Promise<{ ok: true; reading: PlanReading } | { ok: false; error: string }> {
  await requireModule("cotizacion");
  try {
    const file = await cotizador.downloadPlanFile(path);
    return { ok: true, reading: await readPlan({ ...file, name: fileName }) };
  } catch (err) {
    if (err instanceof PlanReadError) return { ok: false, error: err.message };
    console.error("readPlanAction", err);
    return { ok: false, error: "No se pudo leer el plano. Vuelve a intentar en un momento." };
  }
}

export async function createPlanSectionAction(input: cotizador.NewPlanSection): Promise<void> {
  await requireModule("cotizacion");
  await cotizador.createPlanSection(input);
}

export async function planFileUrlAction(path: string): Promise<string | null> {
  await requireModule("cotizacion");
  return cotizador.planFileUrl(path);
}
