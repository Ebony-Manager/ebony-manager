"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import { PAGOS_PATH, STAFF_PATH } from "@/lib/personal/paths";
import * as contractors from "@/services/contractors";

// Contratistas es para quien tiene el módulo `contratistas` (el admin
// siempre): cada action verifica `requireModule("contratistas")` al entrar
// (además de la RLS de las tablas). Un usuario sin el módulo que llame a un
// action a mano igual rebota. Los proyectos (crear, editar, borrar) los
// maneja también quien tiene `proyectos`.

const PATH = PAGOS_PATH;
const PROJECTS_PATH = "/proyectos";

// La lista y la ficha del contratista viven en Personal → Staff
// (`/personal/staff/contratistas/[id]`): un cambio afecta al Dashboard de
// Contratistas, a la lista de Staff y a la ficha, así que se revalidan todos.
function revalidateContractors() {
  revalidatePath(PATH);
  revalidatePath(STAFF_PATH, "layout");
  revalidatePath(PROJECTS_PATH, "layout");
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
  await requireAnyModule("proyectos", "contratistas");
  return contractors.getProjects();
}

export async function createProjectAction(input: contractors.CreateProjectInput) {
  await requireAnyModule("proyectos", "contratistas");
  const project = await contractors.createProject(input);
  revalidateContractors();
  return project;
}

export async function updateProjectAction(id: string, input: contractors.UpdateProjectInput) {
  await requireAnyModule("proyectos", "contratistas");
  const project = await contractors.updateProject(id, input);
  revalidateContractors();
  return project;
}

export async function deleteProjectAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAnyModule("proyectos", "contratistas");
  try {
    await contractors.deleteProject(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidateContractors();
  return { ok: true };
}

export async function getContractorLedgerAction(contractorId: string) {
  await requireModule("contratistas");
  return contractors.getContractorLedger(contractorId);
}

export async function getContractorLoansAction(contractorId: string) {
  await requireModule("contratistas");
  return contractors.getContractorLoans(contractorId);
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

// ── Contratos ──────────────────────────────────────────────────────────
// Las que escriben devuelven el error como dato (en producción Next oculta
// el mensaje de un error lanzado desde una acción).

export type ContractResult = { ok: true } | { ok: false; error: string };

async function contractResult(fn: () => Promise<unknown>): Promise<ContractResult> {
  await requireModule("contratistas");
  try {
    await fn();
  } catch (err) {
    console.error("Contratistas: contrato", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidateContractors();
  return { ok: true };
}

export async function getContractsAction(filter: { contractorId?: string } = {}) {
  await requireModule("contratistas");
  return contractors.getContracts(filter);
}

export async function getContractorAllocationsAction(contractorId: string) {
  await requireModule("contratistas");
  return contractors.getContractorAllocations(contractorId);
}

export async function getContractWorkAction(contractId: string) {
  await requireModule("contratistas");
  return contractors.getContractWork(contractId);
}

export async function createContractAction(
  input: contractors.CreateContractInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let id = "";
  const res = await contractResult(async () => {
    id = await contractors.createContract(input);
  });
  return res.ok ? { ok: true, id } : res;
}

export async function updateContractAction(
  id: string,
  input: contractors.ContractHeaderInput & { work?: contractors.ContractWorkInput | null; workEntryId?: string | null }
) {
  return contractResult(() => contractors.updateContract(id, input));
}

export async function zeroContractorBalanceAction(contractorId: string, date: string, note: string | null) {
  return contractResult(() => contractors.zeroContractorBalance(contractorId, date, note));
}

export async function setContractStatusAction(id: string, status: "ACTIVE" | "COMPLETED") {
  return contractResult(() => contractors.setContractStatus(id, status));
}

export async function deleteContractAction(id: string) {
  return contractResult(() => contractors.deleteContract(id));
}

export async function registerContractorPaymentAction(input: contractors.RegisterPaymentInput) {
  return contractResult(() => contractors.registerContractorPayment(input));
}

// ── Cierre quincenal de contratistas ───────────────────────────────────

export async function getContractorClosingAction(year: number, month: number, half: 1 | 2) {
  await requireModule("contratistas");
  return contractors.getContractorClosing(year, month, half);
}

// El borrador no mueve nada: sin revalidar (la pantalla lleva su propio estado).
export async function setContractorPayLineAction(
  input: Parameters<typeof contractors.setContractorPayLine>[0]
): Promise<ContractResult> {
  await requireModule("contratistas");
  try {
    await contractors.setContractorPayLine(input);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function closeContractorPayPeriodAction(periodId: string) {
  return contractResult(() => contractors.closeContractorPayPeriod(periodId));
}

export async function reopenContractorPayPeriodAction(periodId: string) {
  return contractResult(() => contractors.reopenContractorPayPeriod(periodId));
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

// ── Préstamos y descuentos en cuotas ───────────────────────────────────
// Devuelven el error como dato: en producción Next oculta el mensaje de un
// error lanzado desde una acción.

export type ContractorLoanResult = { ok: true } | { ok: false; error: string };

async function loanResult(fn: () => Promise<void>): Promise<ContractorLoanResult> {
  await requireModule("contratistas");
  try {
    await fn();
  } catch (err) {
    console.error("Contratistas: préstamo", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidateContractors();
  return { ok: true };
}

export async function createContractorLoanAction(input: contractors.ContractorLoanInput) {
  return loanResult(() => contractors.createContractorLoan(input));
}

export async function cancelContractorLoanAction(loanId: string) {
  return loanResult(() => contractors.cancelContractorLoan(loanId));
}

export async function deleteContractorLoanAction(loanId: string) {
  return loanResult(() => contractors.deleteContractorLoan(loanId));
}

export async function adjustContractorInstallmentAction(input: Parameters<typeof contractors.adjustContractorInstallment>[0]) {
  return loanResult(() => contractors.adjustContractorInstallment(input));
}
