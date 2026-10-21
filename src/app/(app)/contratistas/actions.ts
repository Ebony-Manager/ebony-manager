"use server";

import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import { PAGOS_PATH, STAFF_PATH } from "@/lib/personal/paths";
import * as contractors from "@/services/contractors";

// Contratistas es para quien tiene el módulo `contratistas` (el admin
// siempre): cada action verifica `requireModule("contratistas")` al entrar
// (además de la RLS de las tablas). Un usuario sin el módulo que llame a un
// action a mano igual rebota.

const PATH = PAGOS_PATH;

// La lista y la ficha del contratista viven en Personal → Staff
// (`/personal/staff/contratistas/[id]`): un cambio afecta al Dashboard de
// Contratistas, a la lista de Staff y a la ficha, así que se revalidan todos.
function revalidateContractors() {
  revalidatePath(PATH);
  revalidatePath(STAFF_PATH, "layout");
}

export async function createContractorAction(input: contractors.CreateContractorInput) {
  await requireModule("contratistas");
  const contractor = await contractors.createContractor(input);
  revalidateContractors();
  return contractor;
}

export async function updateContractorAction(id: string, input: contractors.UpdateContractorInput) {
  await requireModule("contratistas");
  const contractor = await contractors.updateContractor(id, input);
  revalidateContractors();
  return contractor;
}

export async function deleteContractorAction(id: string) {
  await requireModule("contratistas");
  await contractors.deleteContractor(id);
  revalidateContractors();
}

// ── Proyectos ───────────────────────────────────────────────────────────

export async function getProjectsAction() {
  await requireModule("contratistas");
  return contractors.getProjects();
}

export async function createProjectAction(input: contractors.CreateProjectInput) {
  await requireModule("contratistas");
  const project = await contractors.createProject(input);
  revalidateContractors();
  return project;
}

export async function updateProjectAction(id: string, input: contractors.UpdateProjectInput) {
  await requireModule("contratistas");
  const project = await contractors.updateProject(id, input);
  revalidateContractors();
  return project;
}

export async function deleteProjectAction(id: string) {
  await requireModule("contratistas");
  await contractors.deleteProject(id);
  revalidateContractors();
}

export async function getContractorLedgerAction(contractorId: string) {
  await requireModule("contratistas");
  return contractors.getContractorLedger(contractorId);
}

export async function createLedgerEntryAction(input: contractors.UpsertLedgerEntryInput) {
  await requireModule("contratistas");
  const entry = await contractors.createLedgerEntry(input);
  revalidateContractors();
  return entry;
}

export async function updateLedgerEntryAction(
  id: string,
  input: Omit<contractors.UpsertLedgerEntryInput, "contractorId">
) {
  await requireModule("contratistas");
  const entry = await contractors.updateLedgerEntry(id, input);
  revalidateContractors();
  return entry;
}

export async function deleteLedgerEntryAction(id: string) {
  await requireModule("contratistas");
  await contractors.deleteLedgerEntry(id);
  revalidateContractors();
}

export async function getLedgerEntryItemsAction(ledgerEntryId: string) {
  await requireModule("contratistas");
  return contractors.getLedgerEntryItems(ledgerEntryId);
}

// ── Tarifas de mano de obra ─────────────────────────────────────────────

export async function getLaborRatesAction() {
  await requireModule("contratistas");
  return contractors.getLaborRates();
}

export async function createLaborRateAction(input: contractors.CreateLaborRateInput) {
  await requireModule("contratistas");
  const rate = await contractors.createLaborRate(input);
  revalidatePath(PATH);
  return rate;
}

export async function updateLaborRateAction(id: string, input: contractors.UpdateLaborRateInput) {
  await requireModule("contratistas");
  const rate = await contractors.updateLaborRate(id, input);
  revalidatePath(PATH);
  return rate;
}

// ── Ayudantes del contratista ──────────────────────────────────────────
// Sin `revalidatePath`: el diálogo de ayudantes lleva su propia lista en
// pantalla y nada más en la página depende de estos datos.

export async function getContractorHelpersAction(contractorId: string) {
  await requireModule("contratistas");
  return contractors.getContractorHelpers(contractorId);
}

export async function createContractorHelperAction(contractorId: string, input: contractors.ContractorHelperInput) {
  await requireModule("contratistas");
  return contractors.createContractorHelper(contractorId, input);
}

export async function updateContractorHelperAction(id: string, input: contractors.ContractorHelperInput) {
  await requireModule("contratistas");
  return contractors.updateContractorHelper(id, input);
}

export async function deleteContractorHelperAction(id: string) {
  await requireModule("contratistas");
  await contractors.deleteContractorHelper(id);
}
