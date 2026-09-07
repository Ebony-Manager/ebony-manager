"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import * as employees from "@/services/payroll-employees";
import * as payroll from "@/services/payroll";
import { hourlyRateCents, dailyRateCents, quantityToCents } from "@/lib/planilla/payroll-rates";
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

export async function getRegistroAction(year: number, month: number, half: 1 | 2) {
  await requireAdmin();
  return payroll.getRegistroForPeriod(year, month, half);
}

export async function upsertPayrollEntryAction(input: payroll.UpsertEntryInput) {
  await requireAdmin();
  const entry = await payroll.upsertEntry(input);
  revalidatePath(PATH);
  return entry;
}

/** Las cuatro columnas que se entran como cantidad (horas/días) — el
 *  monto en centavos se deriva acá, una vez, de la tarifa ACTUAL del
 *  empleado, y se guarda junto con la cantidad. No se recalcula en
 *  ningún otro lado: un cambio de salario futuro no debe reflotar una
 *  quincena ya registrada (misma regla de "congelar al entrar" que
 *  todo el módulo). */
export async function upsertPayrollQuantityFieldAction(input: {
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  periodHalf: 1 | 2;
  field: "extraHours" | "extraDays" | "horasDescontadas" | "diasDescontados";
  quantity: number;
}) {
  await requireAdmin();
  const employee = await employees.getPayrollEmployee(input.employeeId);
  if (!employee) throw new Error("Empleado no encontrado");

  const isHourly = input.field === "extraHours" || input.field === "horasDescontadas";
  const rate = isHourly ? hourlyRateCents(employee) : dailyRateCents(employee);
  const cents = quantityToCents(input.quantity, rate);

  const base = {
    employeeId: input.employeeId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    periodHalf: input.periodHalf,
  };
  const q = input.quantity;
  const arg =
    input.field === "extraHours"
      ? { ...base, extraHours: q, extraHoursCents: cents }
      : input.field === "extraDays"
        ? { ...base, extraDays: q, extraDaysCents: cents }
        : input.field === "horasDescontadas"
          ? { ...base, horasDescontadas: q, horasDescontadasCents: cents }
          : { ...base, diasDescontados: q, diasDescontadosCents: cents };

  const entry = await payroll.upsertEntry(arg);
  revalidatePath(PATH);
  return entry;
}

export async function duplicatePreviousPeriodAction(year: number, month: number, half: 1 | 2) {
  await requireAdmin();
  const copied = await payroll.duplicatePreviousPeriod(year, month, half);
  revalidatePath(PATH);
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
