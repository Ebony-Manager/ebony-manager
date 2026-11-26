"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import * as guardado from "@/services/guardado";
import type { StoredOrigin } from "@/types/almacen";

// Apartados: lo registran y entregan Almacén, Diseño o Proyectos (la RLS repite la regla).
const MODULES = ["almacen", "diseno", "proyectos"] as const;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/almacen", "layout");
    revalidatePath("/proyectos", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function createStoredItemAction(origin: "directa" | "cliente", input: guardado.StoredInput) {
  await requireAnyModule(...MODULES);
  return run(() => guardado.createStoredItem(origin, input));
}

export async function updateStoredItemAction(id: string, origin: StoredOrigin, input: guardado.StoredInput) {
  const profile = await requireAnyModule(...MODULES);
  // El costo lo cambia quien lo ve (si no lo ve, no se pisa con un vacío).
  const seesCosts = hasModule(profile, "almacen_compras") || hasModule(profile, "almacen_costos");
  return run(() => guardado.updateStoredItem(id, origin, input, seesCosts));
}

export async function setStoredItemPhotoAction(id: string, path: string | null) {
  await requireAnyModule(...MODULES);
  return run(() => guardado.setStoredItemPhoto(id, path));
}

export async function deliverStoredItemsAction(ids: string[], input: guardado.DeliverInput) {
  await requireAnyModule(...MODULES);
  return run(() => guardado.deliverStoredItems(ids, input));
}

export async function undoStoredDeliveryAction(id: string) {
  await requireAnyModule(...MODULES);
  return run(() => guardado.undoStoredDelivery(id));
}

export async function deleteStoredItemAction(id: string) {
  await requireAnyModule(...MODULES);
  return run(() => guardado.deleteStoredItem(id));
}

export async function getStoredProjectItemsAction(projectId: string) {
  await requireAnyModule(...MODULES);
  try {
    return { ok: true as const, data: await guardado.getStoredProjectItems(projectId) };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
}
