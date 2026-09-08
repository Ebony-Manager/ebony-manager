"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import * as contractors from "@/services/contractors";

// El módulo de Contratistas es solo-admin: cada action verifica
// `requireAdmin()` al entrar (además de la RLS admin-only de las 3
// tablas). Un `vendedor` que llame a un action a mano igual rebota.

const PATH = "/contratistas";

// La ficha del contratista vive en `/contratistas/[id]` (ruta dinámica):
// un movimiento del estado de cuenta afecta tanto al directorio como a
// esa ficha, así que se revalidan las dos.
function revalidateContractors() {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/[id]`, "page");
}

export async function createContractorAction(input: contractors.CreateContractorInput) {
  await requireAdmin();
  const contractor = await contractors.createContractor(input);
  revalidatePath(PATH);
  return contractor;
}

export async function getContractorLedgerAction(contractorId: string) {
  await requireAdmin();
  return contractors.getContractorLedger(contractorId);
}

export async function createLedgerEntryAction(input: contractors.UpsertLedgerEntryInput) {
  await requireAdmin();
  const entry = await contractors.createLedgerEntry(input);
  revalidateContractors();
  return entry;
}

export async function updateLedgerEntryAction(
  id: string,
  input: Omit<contractors.UpsertLedgerEntryInput, "contractorId">
) {
  await requireAdmin();
  const entry = await contractors.updateLedgerEntry(id, input);
  revalidateContractors();
  return entry;
}

export async function deleteLedgerEntryAction(id: string) {
  await requireAdmin();
  await contractors.deleteLedgerEntry(id);
  revalidateContractors();
}
