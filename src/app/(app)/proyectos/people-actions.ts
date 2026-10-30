"use server";

import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getClients } from "@/services/ventas";
import type { Client } from "@/types/ventas";

/**
 * Para la ficha del proyecto: los clientes (arquitectos/diseñadores y
 * clientes finales) para elegir, y si quien edita puede crear uno nuevo
 * (crear clientes es de Ventas; con solo Proyectos se eligen de la lista).
 */
export async function getProjectPeopleAction(): Promise<{ clients: Client[]; canCreate: boolean }> {
  const profile = await requireAnyModule("proyectos", "contratistas", "cotizacion");
  return { clients: await getClients(), canCreate: hasModule(profile, "cotizacion") };
}
