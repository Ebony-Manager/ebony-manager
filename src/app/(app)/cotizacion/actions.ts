"use server";

import { requireModule } from "@/lib/auth/dal";
import * as cotizador from "@/services/cotizador";
import type { Quote, QuoteStatus } from "@/types/cotizador";
import { addProjectSubfolders } from "@/services/drive-opportunity";

// Cotizar pide el módulo `cotizacion`; el catálogo y los insumos solo los
// cambia quien tiene `costos` (el admin, los dos). La RLS de las tablas
// `quote_*` repite las dos reglas como última línea.
//
// Sin `revalidatePath`: el editor es optimista (la pantalla ya muestra lo
// que se guardó) y las páginas son `force-dynamic`, así que la lista
// vuelve a leer sola al entrar.

/**
 * Resultado de guardar: el error va como dato (no lanzado) para que llegue
 * tal cual a la pantalla también en producción; `conflict` = otra persona
 * guardó la cotización mientras se editaba.
 */
export type SaveResult<T> = { ok: true; data: T } | { ok: false; conflict: boolean; error: string };

async function saving<T>(fn: () => Promise<T>): Promise<SaveResult<T>> {
  await requireModule("cotizacion");
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error";
    return { ok: false, conflict: error === cotizador.QUOTE_CONFLICT, error };
  }
}

/** Primer guardado de una cotización nueva (hasta ahí solo vivía en el editor): la base le pone el número. */
export async function createQuoteAction(quote: Quote) {
  return saving(() => cotizador.createQuote(quote));
}

/** Devuelve el updated_at nuevo (el editor lo manda en el siguiente guardado). */
export async function saveQuoteAction(quote: Quote, expected: string | null) {
  return saving(() => cotizador.saveQuote(quote, expected));
}

/**
 * Cambia el estado con sus reglas. Al aprobar una de oportunidad, su carpeta
 * de Drive recibe las subcarpetas del proyecto (igual que desde Seguimiento).
 */
export async function setQuoteStatusAction(id: string, status: QuoteStatus, input: cotizador.SetQuoteStatusInput = {}, opportunityId: string | null = null) {
  return saving(async () => {
    const res = await cotizador.setQuoteStatus(id, status, input);
    if (status === "APROBADA" && opportunityId) await addProjectSubfolders(opportunityId).catch(() => {});
    return res;
  });
}

export async function addQuoteImageAction(sectionId: string, path: string) {
  return saving(() => cotizador.addQuoteImage(sectionId, path));
}

export async function deleteQuoteImageAction(id: string) {
  return saving(() => cotizador.deleteQuoteImage(id));
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
