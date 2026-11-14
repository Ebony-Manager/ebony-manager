"use server";

import { requireModule } from "@/lib/auth/dal";
import { getContractorOffsets, getContractorsDashboardInput, getContracts } from "@/services/contractors";
import { todayInPanama } from "@/lib/contractors/contractor-loans";

/**
 * El historial de los contratistas (para Préstamos y Saldos), pedido solo
 * cuando se abre una de esas pestañas: bajarlo con cada carga de Pagos gastaba
 * mucho tráfico de Supabase (se pedía ~190 veces al día).
 */
export async function getContractorsDashboardAction() {
  await requireModule("contratistas");
  const [input, contracts, offsets] = await Promise.all([getContractorsDashboardInput(), getContracts(), getContractorOffsets(todayInPanama())]);
  // Lo que falta por pagar en cada contrato: es lo que explica el saldo de cada contratista.
  const pending = contracts
    .filter((c) => c.valueCents - c.allocatedCents > 0)
    .map((c) => ({ contractorId: c.contractorId, contractId: c.id, name: c.name, projectName: c.projectName, pendingCents: c.valueCents - c.allocatedCents }));
  return { ...input, pending, offsets };
}
