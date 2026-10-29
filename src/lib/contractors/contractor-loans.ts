/**
 * Préstamos y descuentos de contratistas en cuotas (igual que a empleados).
 * Cada cuota es un movimiento del estado de cuenta (`reduce`) con `loanId`,
 * fechado al inicio de su quincena (el 1 o el 16) — la primera, nunca antes
 * de la fecha de la solicitud. Una cuota con fecha futura está
 * "programada": se ve en el estado de cuenta pero todavía no cuenta en el
 * saldo. Puro, sin Supabase.
 */
import type { Period } from "@/lib/planilla/payroll-period";

/** Hoy en Panamá, "YYYY-MM-DD" (el servidor corre en UTC). */
export function todayInPanama(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Panama" }).format(now);
}

/** Fecha de una cuota: el inicio de su quincena, sin ir antes de la solicitud. */
export function installmentDate(period: Period, requestDate: string): string {
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-${period.half === 1 ? "01" : "16"}`;
  return start < requestDate ? requestDate : start;
}

/** La quincena de una fecha (1–15 → 1ra, 16+ → 2da): lo inverso de `installmentDate`. */
export function periodOfDate(date: string): Period {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, half: day >= 16 ? 2 : 1 };
}

/** Una cuota que todavía no llega (no cuenta en el saldo de hoy). Los
 *  movimientos sueltos (sin préstamo) cuentan siempre, tengan la fecha que tengan. */
export function isScheduled(e: { loanId: string | null; entryDate: string }, today: string): boolean {
  return e.loanId !== null && e.entryDate > today;
}
