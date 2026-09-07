/**
 * Tipos de dominio de la Planilla (camelCase), portados del bloque
 * payroll de Atlas (Life OS) `src/types/home.ts`.
 *
 * Se separan de `src/types/database.ts` (los Row/Insert/Update
 * snake_case que genera Supabase) a propósito: el servicio mapea de una
 * forma a la otra, y la capa de cálculos trabaja solo con estos.
 *
 * Cambios vs. Atlas:
 *  - `Employee` -> `PayrollEmployee`, sin `propertyId` (Ebony es una sola
 *    empresa).
 *  - `PayrollEntry` sin `financeTransactionId` (no hay módulo de Gastos).
 * Décimo, Vacación, Prima de Antigüedad y saldos de ledger SIEMPRE se
 * computan (ver `src/lib/planilla/payroll-accruals.ts`), nunca se
 * guardan, así que nada acá los duplica como campo mutable.
 */

export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export interface PayrollEmployee {
  id: string;
  name: string;
  position: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EmployeeStatus;
  /** Salario MENSUAL en papel al día de hoy. La base realmente pagada en
   *  una quincena vive en cada PayrollEntry, porque un aumento real no
   *  reescribe la historia. */
  baseSalaryCents: number;
  /** Null salvo que haya un acuerdo real de calcular Décimo/Vacación/
   *  Prima sobre una base distinta (normalmente menor) a la que se paga
   *  — el caso "Acumulado a 500". Cuando está seteada, cada prestación
   *  se computa dos veces (real y sobre esta) y se muestran ambas. */
  benefitsBaseSalaryCents: number | null;
  notes: string | null;
  /** Se setea junto con `endDate` al liquidar — aclaraciones/disputas/
   *  ajustes sobre ESA liquidación, aparte de `notes`. */
  liquidationNotes: string | null;
  sortOrder: number;
  /** Cédula o pasaporte, lo que la persona cargue — un solo campo. */
  idDocument: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  contractInfo: string | null;
}

export type PaymentMethod = "efectivo" | "transferencia" | "yappy" | "cheque";

export interface PayrollEntry {
  id: string;
  employeeId: string;
  periodYear: number;
  /** 1-12 */
  periodMonth: number;
  /** 1 o 2 — cuál quincena del mes. Setups mensuales usan siempre 1. */
  periodHalf: 1 | 2;
  basePayCents: number;
  /** Cantidad de horas extra entrada por el usuario; `extraHoursCents`
   *  es a cuánto resolvió a la tarifa por hora al momento de entrar
   *  (congelado, nunca se recalcula si el salario cambia después). */
  extraHours: number;
  extraHoursCents: number;
  extraDays: number;
  extraDaysCents: number;
  viaticosCents: number;
  bonusCents: number;
  /** "Días Libres" — subsidio pagado por días libres otorgados, aparte
   *  de `extraDaysCents` (días extra trabajados, lo opuesto). */
  diasLibresCents: number;
  /** Horas/Días Descontados — horas/días sin pagar por debajo de la
   *  jornada normal, tarifa congelada al entrar igual que `extraDays`.
   *  `otherDeductionCents` es el catch-all para cualquier otro
   *  descuento. */
  horasDescontadas: number;
  horasDescontadasCents: number;
  diasDescontados: number;
  diasDescontadosCents: number;
  otherDeductionCents: number;
  /** Montos de Décimo/Vacación/Prima REALMENTE pagados esta quincena —
   *  distinto del acumulado bruto que calculan las fórmulas. Un
   *  `primaAntiguedadPaidCents` > 0 reinicia el reloj del acumulado de
   *  Prima hacia adelante, igual que `vacationPaidCents` para Vacación. */
  decimoPaidCents: number;
  vacationPaidCents: number;
  primaAntiguedadPaidCents: number;
  paymentMethod: PaymentMethod;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
}

export type LedgerCategory =
  | "prestamo"
  | "adelanto"
  | "herramienta"
  | "dano"
  /** Caja de Seguro Social — solo algunos empleados. Informativa: nunca
   *  reduce lo que se le paga a la persona. */
  | "seguro_social"
  /** Renovación de Carnet — igual, específica de ciertos empleados. */
  | "carnet"
  | "otro";

export type LedgerDirection = "debt" | "payment";

export interface PayrollLedgerEntry {
  id: string;
  employeeId: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  entryDate: string;
  /** En qué quincena se otorgó o contra cuál se abonó, si aplica. */
  payrollEntryId: string | null;
  /** Qué PayrollLoan creó esta fila (el monto otorgado, o una cuota),
   *  si aplica — null para un movimiento agregado a mano. */
  loanId: string | null;
  notes: string | null;
}

/** Esquema de reparto de las cuotas de un préstamo. Hoy solo existe
 *  'cuota_fija'; queda como union de strings (no boolean) para que un
 *  esquema futuro (ej. % del salario) sea aditivo. */
export type LoanPaymentMethod = "cuota_fija";

export interface PayrollLoan {
  id: string;
  employeeId: string;
  category: "prestamo" | "adelanto";
  principalCents: number;
  paymentMethod: LoanPaymentMethod;
  numInstallments: number;
  requestDate: string;
  startPeriod: { year: number; month: number; half: 1 | 2 };
  status: "active" | "cancelled";
  notes: string | null;
}

/** Una cuota programada de un préstamo — siempre respaldada por un
 *  PayrollLedgerEntry real (direction 'payment') enganchado a una
 *  quincena materializada, así `paid` refleja si esa quincena ya se
 *  pagó, nunca una adivinanza por fecha de hoy. */
export interface PayrollLoanInstallment {
  ledgerEntryId: string;
  period: { year: number; month: number; half: 1 | 2 };
  amountCents: number;
  paid: boolean;
}

export interface PayrollLoanWithSchedule extends PayrollLoan {
  installments: PayrollLoanInstallment[];
}

/** Una celda/fila computada de pago para un empleado en una quincena —
 *  la forma que devuelve la capa de cálculos donde se necesita un "cuánto
 *  cobró/cobra esta persona esta quincena". Todo lo que sigue a `entry`
 *  es derivado, nunca guardado. */
export interface PayrollPeriodTotal {
  entry: PayrollEntry | null;
  /** deuda otorgada o abonada contra esta quincena, del ledger */
  ledgerDebtCents: number;
  ledgerPaymentCents: number;
  /** base + extraHoursCents + extraDaysCents + viaticosCents + bonusCents
   *  + diasLibresCents + decimoPaidCents + vacationPaidCents
   *  + primaAntiguedadPaidCents - horasDescontadasCents
   *  - diasDescontadosCents - otherDeductionCents - ledgerPaymentCents */
  totalCents: number;
}
