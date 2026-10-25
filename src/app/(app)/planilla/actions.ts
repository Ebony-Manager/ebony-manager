"use server";

import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import { PAGOS_PATH, STAFF_PATH } from "@/lib/personal/paths";
import * as employees from "@/services/payroll-employees";
import * as payroll from "@/services/payroll";
import * as attendance from "@/services/attendance";
import * as salary from "@/services/payroll-salary";
import * as positions from "@/services/payroll-positions";
import type { RawPunch } from "@/lib/attendance/types";
import { foldName } from "@/lib/attendance/parse";
import type { LedgerCategory, LedgerDirection, LoanCategory, LoanPaymentMethod } from "@/types/planilla";

// Planilla es para quien tiene el módulo `planilla` (el admin siempre):
// cada action verifica `requireModule("planilla")` al entrar (además de la
// RLS `private.has_module('planilla')` de las tablas). Un usuario sin el
// módulo que llame a un action a mano igual rebota.

const PATH = PAGOS_PATH;

// Los empleados se listan y se editan en Personal → Staff (la lista y la
// ficha `/personal/staff/empleados/[id]`): se revalida Planilla y todo Staff.
function revalidatePlanilla() {
  revalidatePath(PATH);
  revalidatePath(STAFF_PATH, "layout");
}

export async function createEmployeeAction(input: employees.CreatePayrollEmployeeInput) {
  await requireModule("planilla");
  const employee = await employees.createPayrollEmployee(input);
  revalidatePlanilla();
  return employee;
}

export async function updateEmployeeAction(id: string, input: employees.UpdatePayrollEmployeeInput) {
  await requireModule("planilla");
  await employees.updatePayrollEmployee(id, input);
  revalidatePlanilla();
}

export async function getRegistroAction(year: number, month: number, half: 1 | 2) {
  await requireModule("planilla");
  return payroll.getRegistroForPeriod(year, month, half);
}

// OJO: las acciones de quincena (esta, la de cantidades y duplicar) NO llaman
// a `revalidatePath`. Hacerlo obliga a Next a volver a renderizar TODA la
// página /planilla en el servidor (autenticación, empleados, posiciones…)
// después de cada clic y a esperar ese resultado antes de responder: era la
// causa de que cambiar el método de pago o marcar "Pagado" tardara. Registro
// pide sus propios datos por `getRegistroAction`, así que no lo necesita.
export async function upsertPayrollEntryAction(input: payroll.UpsertEntryInput) {
  await requireModule("planilla");
  return payroll.upsertEntry(input);
}

/** Borra las horas/días descontados y las horas extra de la quincena (rehacer una importación). */
export async function clearPeriodHoursAction(year: number, month: number, half: 1 | 2) {
  await requireModule("planilla", "asistencia");
  return { cleared: await payroll.clearPeriodHours(year, month, half) };
}

// Asistencia: ponchadas guardadas (reloj por archivo, Jotform por webhook).
export async function getAttendanceAction(from: string, to: string) {
  await requireModule("planilla", "asistencia");
  const [punches, links, status, resolutions] = await Promise.all([
    attendance.getPunches(from, to),
    attendance.getNameLinks(),
    attendance.getAttendanceStatus(),
    attendance.getResolutions(from, to),
  ]);
  return { punches, links, status, resolutions };
}

/** Deshace un vínculo nombre → empleado (vuelve a salir como "sin vincular"). */
export async function unlinkAttendanceNameAction(nameKey: string) {
  await requireModule("planilla", "asistencia");
  await attendance.deleteNameLink(nameKey);
}

/** Revisar un día: hora real de entrada y/o salida (null y null = no vino). */
export async function resolveAttendanceDayAction(input: {
  employeeId: string;
  date: string;
  arrival: number | null;
  departure: number | null;
  note: string | null;
}) {
  const profile = await requireModule("planilla", "asistencia");
  const okMinutes = (m: number | null) => m === null || (Number.isInteger(m) && m >= 0 && m < 1440);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !okMinutes(input.arrival) || !okMinutes(input.departure)) {
    throw new Error("Datos inválidos");
  }
  await attendance.setResolution(input, profile.id);
}

export async function unresolveAttendanceDayAction(employeeId: string, date: string) {
  await requireModule("planilla", "asistencia");
  await attendance.deleteResolution(employeeId, date);
}

export async function importPunchesAction(punches: RawPunch[]) {
  const profile = await requireModule("planilla", "asistencia");
  return attendance.importPunches(punches, profile.id);
}

/** Vincula un nombre de las ponchadas a un empleado (null = no es empleado, se ignora). */
export async function linkAttendanceNameAction(name: string, employeeId: string | null) {
  const profile = await requireModule("planilla", "asistencia");
  await attendance.setNameLink(foldName(name), employeeId, profile.id);
}

// ── Reportes (solo lectura; igual verifican admin) ─────────────────────

export async function getAnnualSummaryAction(year: number) {
  await requireModule("planilla");
  return payroll.getAnnualSummary(year);
}

export async function getAttendanceSummaryAction(year: number) {
  await requireModule("planilla");
  return payroll.getAttendanceSummary(year);
}

export async function getAuditoriaDataAction(year: number) {
  await requireModule("planilla");
  return payroll.getAuditoriaData(year);
}

export async function getUpcomingObligationsAction() {
  await requireModule("planilla");
  return payroll.getUpcomingObligations();
}

export async function getEmployeeAnnualDetailAction(employeeId: string, year: number, projectFuture = false) {
  await requireModule("planilla");
  return payroll.getEmployeeAnnualDetail(employeeId, year, projectFuture);
}

// ── Ledger genérico ───────────────────────────────────────────────────

export async function getLedgerEntriesAction(employeeId: string) {
  await requireModule("planilla");
  return payroll.getLedgerEntries(employeeId);
}

/** Todo lo que necesita el Dashboard en UNA sola llamada (antes eran
 *  varias, y Next las atiende una detrás de otra). */
export async function getPlanillaOverviewAction(year: number) {
  await requireModule("planilla");
  return payroll.getPlanillaOverview(year);
}

export async function getLedgerBalanceAction(employeeId: string) {
  await requireModule("planilla");
  return payroll.getLedgerBalance(employeeId);
}

// OJO: los movimientos, préstamos e InDrive tampoco llaman a `revalidatePath`
// (misma razón que arriba: obligaba a Next a re-renderizar toda la página tras
// cada clic). La ventana del empleado lleva su propia lista en pantalla y
// avisa a Registro para que se vuelva a leer.
export async function createLedgerEntryAction(input: {
  employeeId: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  entryDate: string;
  payrollEntryId?: string | null;
  notes?: string | null;
}) {
  await requireModule("planilla");
  return payroll.createLedgerEntry(input);
}

export async function deleteLedgerEntryAction(id: string) {
  await requireModule("planilla");
  await payroll.deleteLedgerEntry(id);
}

// ── Préstamos / adelantos / herramientas / daños ──────────────────────

export async function getLoansAction(employeeId: string) {
  await requireModule("planilla");
  return payroll.getLoansForEmployee(employeeId);
}

type LoanInput = {
  employeeId: string;
  category: LoanCategory;
  principalCents: number;
  paymentMethod?: LoanPaymentMethod;
  requestDate: string;
  numInstallments: number;
  startPeriod?: { year: number; month: number; half: 1 | 2 };
  installmentAmountsCents?: number[];
  interest?: { mode: "monthly_pct" | "total_pct" | "fixed"; ratePct?: number | null; fixedCents?: number | null } | null;
  notes?: string | null;
};

/** Resultado "esperable" de un guardado: en producción Next oculta el mensaje
 *  de un error lanzado desde una acción, así que los fallos previsibles
 *  (migración pendiente, cuotas que no suman, préstamo con cuotas pagadas…)
 *  se devuelven como dato para poder mostrarlos tal cual. */
export type SaveResult = { ok: true } | { ok: false; error: string; migrationPending?: boolean };

function toSaveError(err: unknown): SaveResult {
  const message = err instanceof Error ? err.message : "Error";
  const migrationPending =
    message.includes("payroll_loans_category_check") ||
    message.includes("payroll_ledger_entries_category_check") ||
    message.includes("interest_");
  return { ok: false, error: message, migrationPending };
}

export async function createLoanAction(input: LoanInput): Promise<SaveResult> {
  await requireModule("planilla");
  try {
    await payroll.createLoan(input);
    return { ok: true };
  } catch (err) {
    console.error("createLoanAction", err);
    return toSaveError(err);
  }
}

/** Edita un préstamo (monto, cuotas, esquema, inicio) — solo si no tiene
 *  cuotas pagadas. */
export async function replaceLoanAction(loanId: string, input: LoanInput): Promise<SaveResult> {
  await requireModule("planilla");
  try {
    await payroll.replaceLoan(loanId, input);
    return { ok: true };
  } catch (err) {
    console.error("replaceLoanAction", err);
    return toSaveError(err);
  }
}

export async function updateLoanNotesAction(loanId: string, notes: string | null) {
  await requireModule("planilla");
  await payroll.updateLoanNotes(loanId, notes);
}

export async function cancelLoanAction(loanId: string) {
  await requireModule("planilla");
  await payroll.cancelLoan(loanId);
}

export async function deleteLoanAction(loanId: string) {
  await requireModule("planilla");
  await payroll.deleteLoan(loanId);
}

/** Edita una cuota pendiente (no pagada) de un préstamo — el resto del
 *  calendario se reacomoda solo (`reflowLoanInstallment`). */
export async function reflowLoanInstallmentAction(input: {
  loanId: string;
  employeeId: string;
  ledgerEntryId: string;
  newAmountCents: number;
  mode?: "extend" | "spread";
}) {
  await requireModule("planilla");
  await payroll.reflowLoanInstallment(input);
}

export async function getLoansOverviewAction() {
  await requireModule("planilla");
  return payroll.getLoansOverview();
}

// ── Sueldo / aumentos ─────────────────────────────────────────────────

export async function getSalaryChangesAction(employeeId: string) {
  await requireModule("planilla");
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
  await requireModule("planilla");
  const change = await salary.registerSalaryChange(input);
  revalidatePlanilla();
  return change;
}

// ── Posiciones (catálogo editable) ─────────────────────────────────────

export async function getPayrollPositionsAction() {
  await requireModule("planilla");
  return positions.getPayrollPositions();
}

export async function createPayrollPositionAction(name: string) {
  await requireModule("planilla");
  const position = await positions.createPayrollPosition(name);
  revalidatePlanilla();
  return position;
}

export async function updatePayrollPositionAction(id: string, input: { name?: string; active?: boolean }) {
  await requireModule("planilla");
  await positions.updatePayrollPosition(id, input);
  revalidatePlanilla();
}

// ── Borrar empleado (irreversible; la UI confirma antes) ──────────────

export async function deleteEmployeeAction(id: string) {
  await requireModule("planilla");
  await employees.deletePayrollEmployee(id);
  revalidatePlanilla();
}
