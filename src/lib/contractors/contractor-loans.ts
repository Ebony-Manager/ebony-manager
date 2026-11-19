/**
 * Préstamos y descuentos de contratistas en cuotas (igual que a empleados).
 * Cada cuota es un movimiento del estado de cuenta (`reduce`) con `loanId`,
 * fechado al inicio de su quincena (el 1 o el 16) — la primera, nunca antes
 * de la fecha de la solicitud. Una cuota con fecha futura está
 * "programada": se ve en el estado de cuenta pero todavía no cuenta en el
 * saldo. Puro, sin Supabase.
 */
import type { Period } from "@/lib/planilla/payroll-period";
import {
  computeLoanInterestCents,
  computeLoanSchedule,
  defaultLoanStartPeriod,
  isSingleInstallment,
  type LoanInterestInput,
} from "@/lib/planilla/payroll-loans";
import type { LoanCategory, LoanPaymentMethod } from "@/types/planilla";

/** Lo que se le puede financiar/descontar a un contratista (el descuento a
 *  terceros es solo de empleados). */
export const CONTRACTOR_LOAN_CATEGORIES = ["prestamo", "adelanto", "herramienta", "dano", "indrive", "otro"] as const;

export const CONTRACTOR_LOAN_LABEL: Record<LoanCategory, string> = {
  prestamo: "Préstamo",
  adelanto: "Adelanto",
  herramienta: "Herramienta",
  dano: "Daño",
  indrive: "InDrive",
  otro: "Otro descuento",
  tercero: "Descuento a terceros",
};

export interface ContractorLoanPlanInput {
  category: LoanCategory;
  principalCents: number;
  paymentMethod?: LoanPaymentMethod;
  requestDate: string;
  numInstallments: number;
  startPeriod?: Period;
  installmentAmountsCents?: number[];
  interest?: LoanInterestInput | null;
}

export interface ContractorLoanPlan {
  paymentMethod: LoanPaymentMethod;
  numInstallments: number;
  startPeriod: Period;
  interestCents: number;
  /** Cada cuota con la fecha en que entra al estado de cuenta. */
  installments: { period: Period; date: string; amountCents: number; description: string }[];
}

/** Cómo queda un préstamo/descuento de contratista: cuotas, fechas e
 *  interés. Lo usan el servicio al guardarlo y el MCP para la vista
 *  previa, así los dos calculan igual. Lanza si la entrada no sirve. */
export function planContractorLoan(input: ContractorLoanPlanInput): ContractorLoanPlan {
  if (input.category === "tercero") throw new Error("El descuento a terceros es solo para empleados");
  if (!(input.principalCents > 0)) throw new Error("El monto debe ser mayor que cero");
  const paymentMethod = input.paymentMethod ?? "cuota_fija";
  const numInstallments = isSingleInstallment(input.category) ? 1 : input.numInstallments;
  const startPeriod = input.startPeriod ?? defaultLoanStartPeriod(input.category, input.requestDate);
  if (!startPeriod) throw new Error("Fecha de solicitud inválida");
  const interestCents = computeLoanInterestCents(input.principalCents, numInstallments, input.interest);
  const schedule = computeLoanSchedule(
    input.principalCents + interestCents,
    numInstallments,
    startPeriod,
    paymentMethod,
    input.installmentAmountsCents
  );
  const label = CONTRACTOR_LOAN_LABEL[input.category];
  return {
    paymentMethod,
    numInstallments,
    startPeriod,
    interestCents,
    installments: schedule.map((cuota, i) => ({
      period: cuota.period,
      date: installmentDate(cuota.period, input.requestDate),
      amountCents: cuota.amountCents,
      description: numInstallments > 1 ? `${label} · cuota ${i + 1} de ${numInstallments}` : label,
    })),
  };
}

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
