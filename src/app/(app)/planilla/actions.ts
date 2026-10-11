"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import * as employees from "@/services/payroll-employees";
import * as payroll from "@/services/payroll";
import * as salary from "@/services/payroll-salary";
import * as positions from "@/services/payroll-positions";
import type { LedgerCategory, LedgerDirection, LoanPaymentMethod } from "@/types/planilla";

// La Planilla es solo-admin: cada action verifica `requireAdmin()` al
// entrar (además de la RLS admin-only de las 4 tablas). Un `vendedor`
// que llame a un action a mano igual rebota.

const PATH = "/planilla";

export async function createEmployeeAction(input: employees.CreatePayrollEmployeeInput) {
  await requireAdmin();
  const employee = await employees.createPayrollEmployee(input);
  revalidatePath(PATH);
  return employee;
}

export async function updateEmployeeAction(id: string, input: employees.UpdatePayrollEmployeeInput) {
  await requireAdmin();
  await employees.updatePayrollEmployee(id, input);
  revalidatePath(PATH);
}

/** Marca a varios empleados como que ya no laboran (o los reactiva). */
export async function setEmployeesStatusAction(ids: string[], status: "ACTIVE" | "INACTIVE") {
  await requireAdmin();
  const count = await employees.setPayrollEmployeesStatus(ids, status);
  revalidatePath(PATH);
  return count;
}

export async function getRegistroAction(year: number, month: number, half: 1 | 2) {
  await requireAdmin();
  return payroll.getRegistroForPeriod(year, month, half);
}

// OJO: las acciones de quincena (esta, la de cantidades y duplicar) NO llaman
// a `revalidatePath`. Hacerlo obliga a Next a volver a renderizar TODA la
// página /planilla en el servidor (autenticación, empleados, posiciones…)
// después de cada clic y a esperar ese resultado antes de responder: era la
// causa de que cambiar el método de pago o marcar "Pagado" tardara. Registro
// pide sus propios datos por `getRegistroAction`, así que no lo necesita.
export async function upsertPayrollEntryAction(input: payroll.UpsertEntryInput) {
  await requireAdmin();
  return payroll.upsertEntry(input);
}

export async function duplicatePreviousPeriodAction(year: number, month: number, half: 1 | 2) {
  await requireAdmin();
  const copied = await payroll.duplicatePreviousPeriod(year, month, half);
  return { copied };
}

// ── Reportes (solo lectura; igual verifican admin) ─────────────────────

export async function getAnnualSummaryAction(year: number) {
  await requireAdmin();
  return payroll.getAnnualSummary(year);
}

export async function getAuditoriaDataAction(year: number) {
  await requireAdmin();
  return payroll.getAuditoriaData(year);
}

export async function getUpcomingObligationsAction() {
  await requireAdmin();
  return payroll.getUpcomingObligations();
}

export async function getEmployeeAnnualDetailAction(employeeId: string, year: number, projectFuture = false) {
  await requireAdmin();
  return payroll.getEmployeeAnnualDetail(employeeId, year, projectFuture);
}

// ── Ledger genérico ───────────────────────────────────────────────────

export async function getLedgerEntriesAction(employeeId: string) {
  await requireAdmin();
  return payroll.getLedgerEntries(employeeId);
}

/** Todo lo que necesita el Dashboard en UNA sola llamada (antes eran
 *  varias, y Next las atiende una detrás de otra). */
export async function getPlanillaOverviewAction(year: number) {
  await requireAdmin();
  return payroll.getPlanillaOverview(year);
}

export async function getLedgerBalanceAction(employeeId: string) {
  await requireAdmin();
  return payroll.getLedgerBalance(employeeId);
}

export async function createLedgerEntryAction(input: {
  employeeId: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  entryDate: string;
  payrollEntryId?: string | null;
  notes?: string | null;
}) {
  await requireAdmin();
  const entry = await payroll.createLedgerEntry(input);
  revalidatePath(PATH);
  return entry;
}

export async function deleteLedgerEntryAction(id: string) {
  await requireAdmin();
  await payroll.deleteLedgerEntry(id);
  revalidatePath(PATH);
}

// ── Préstamos / adelantos ─────────────────────────────────────────────

export async function getLoansAction(employeeId: string) {
  await requireAdmin();
  return payroll.getLoansForEmployee(employeeId);
}

export async function createLoanAction(input: {
  employeeId: string;
  category: "prestamo" | "adelanto";
  principalCents: number;
  paymentMethod?: LoanPaymentMethod;
  requestDate: string;
  numInstallments: number;
  startPeriod?: { year: number; month: number; half: 1 | 2 };
  notes?: string | null;
}) {
  await requireAdmin();
  const loan = await payroll.createLoan(input);
  revalidatePath(PATH);
  return loan;
}

export async function cancelLoanAction(loanId: string) {
  await requireAdmin();
  await payroll.cancelLoan(loanId);
  revalidatePath(PATH);
}

/** Edita una cuota pendiente (no pagada) de un préstamo — el resto del
 *  calendario se reacomoda solo (`reflowLoanInstallment`). */
export async function reflowLoanInstallmentAction(input: {
  loanId: string;
  employeeId: string;
  ledgerEntryId: string;
  newAmountCents: number;
}) {
  await requireAdmin();
  await payroll.reflowLoanInstallment(input);
  revalidatePath(PATH);
}

// ── Sueldo / aumentos ─────────────────────────────────────────────────

export async function getSalaryChangesAction(employeeId: string) {
  await requireAdmin();
  return salary.getSalaryChanges(employeeId);
}

export async function registerSalaryChangeAction(input: {
  employeeId: string;
  monthlySalaryCents: number;
  benefitsBaseSalaryCents?: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveHalf: 1 | 2;
  notes?: string | null;
}) {
  await requireAdmin();
  const change = await salary.registerSalaryChange(input);
  revalidatePath(PATH);
  return change;
}

// ── Posiciones (catálogo editable) ─────────────────────────────────────

export async function getPayrollPositionsAction() {
  await requireAdmin();
  return positions.getPayrollPositions();
}

export async function createPayrollPositionAction(name: string) {
  await requireAdmin();
  const position = await positions.createPayrollPosition(name);
  revalidatePath(PATH);
  return position;
}

export async function updatePayrollPositionAction(id: string, input: { name?: string; active?: boolean }) {
  await requireAdmin();
  await positions.updatePayrollPosition(id, input);
  revalidatePath(PATH);
}

// ── Borrar empleado (irreversible; la UI confirma antes) ──────────────

export async function deleteEmployeeAction(id: string) {
  await requireAdmin();
  await employees.deletePayrollEmployee(id);
  revalidatePath(PATH);
}
