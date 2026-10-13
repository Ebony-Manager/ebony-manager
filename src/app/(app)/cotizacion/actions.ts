"use server";

import { requireAdmin, requireProfile } from "@/lib/auth/dal";
import * as cotizador from "@/services/cotizador";
import type { Quote } from "@/types/cotizador";

// Cotizar es para cualquier usuario de la app (`requireProfile`); el
// catálogo y los insumos solo los cambia el admin (`requireAdmin`). La RLS
// de las tablas `quote_*` repite las dos reglas como última línea.
//
// Sin `revalidatePath`: el editor es optimista (la pantalla ya muestra lo
// que se guardó) y las páginas son `force-dynamic`, así que la lista
// vuelve a leer sola al entrar.

export async function createQuoteAction(): Promise<string> {
  await requireProfile();
  return cotizador.createQuote();
}

export async function saveQuoteAction(quote: Quote): Promise<void> {
  await requireProfile();
  await cotizador.saveQuote(quote);
}

export async function duplicateQuoteAction(id: string): Promise<string> {
  await requireProfile();
  return cotizador.duplicateQuote(id);
}

export async function deleteQuoteAction(id: string): Promise<void> {
  await requireProfile();
  await cotizador.deleteQuote(id);
}

export async function updateCatalogItemAction(id: string, patch: { price?: number; active?: boolean; name?: string }) {
  await requireAdmin();
  await cotizador.updateCatalogItem(id, patch);
}

export async function createCatalogItemAction(input: cotizador.CreateCatalogItemInput) {
  await requireAdmin();
  return cotizador.createCatalogItem(input);
}

export async function updateCostInputAction(key: string, value: number) {
  await requireAdmin();
  await cotizador.updateCostInput(key, value);
}
