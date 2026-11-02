"use server";

import { requireModule } from "@/lib/auth/dal";
import { getContractorsDashboardInput } from "@/services/contractors";

/**
 * El historial de los contratistas (para Préstamos y Saldos), pedido solo
 * cuando se abre una de esas pestañas: bajarlo con cada carga de Pagos gastaba
 * mucho tráfico de Supabase (se pedía ~190 veces al día).
 */
export async function getContractorsDashboardAction() {
  await requireModule("contratistas");
  return getContractorsDashboardInput();
}
