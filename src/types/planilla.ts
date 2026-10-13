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

export type BankAccountType = "ahorro" | "corriente";

/** Solo una etiqueta para filtrar/agrupar — Taller y Administrativo usan
 *  el mismo motor de planilla (mismas fórmulas de décimo/vacación/prima,
 *  mismo Registro), no es un sistema aparte. */
export type EmployeeCategoria = "taller" | "administrativo";

export interface PayrollEmployee {
  id: string;
  name: string;
  position: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EmployeeStatus;
  categoria: EmployeeCategoria;
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
  /** Número de cédula o pasaporte (el tipo va en `idDocumentType`). */
  idDocument: string | null;
  idDocumentType: "cedula" | "pasaporte" | null;
  nationality: string | null;
  /** Fecha de nacimiento, `YYYY-MM-DD`. */
  birthDate: string | null;
  /** Ruta de la foto en el bucket privado `employee-photos`; null = sin foto. */
  photoPath: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  contractInfo: string | null;
  /** Cuenta donde se le paga. Base para el export a Banco General
   *  (Tanda 5) — si el formato real necesita más campos, se agregan
   *  entonces. Los cuatro son independientes y opcionales. */
  bankName: string | null;
  bankAccountType: BankAccountType | null;
  bankAccountNumber: string | null;
  /** Ruta del banco / código de ruta — texto libre, lo llena el dueño a mano. */
  bankRoutingCode: string | null;
}

/** Una posición/función del catálogo editable (Calificado, Ayudante,
 *  Jefe de Taller...) — alimenta el dropdown de "Posición" del formulario
 *  de empleado. `PayrollEmployee.position` sigue siendo texto libre; este
 *  catálogo solo cura las opciones sugeridas, nunca fuerza los datos ya
 *  cargados. Desactivar (`active: false`) es el único "borrado" — nunca
 *  delete real, así ningún empleado histórico con esa posición queda
 *  roto. */
export interface PayrollPosition {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

export type PaymentMethod = "efectivo" | "transferencia" | "yappy" | "cheque";

/** Una fila del historial de sueldos: "desde esta quincena el sueldo
 *  mensual es X". El sueldo de una quincena es la fila más reciente con
 *  fecha efectiva <= esa quincena. Es el único lugar que manda sobre el
 *  sueldo; `PayrollEmployee.baseSalaryCents` es solo un reflejo. */
export interface PayrollSalaryChange {
  id: string;
  employeeId: string;
  monthlySalaryCents: number;
  /** Base alterna para prestaciones en este tramo; null = igual al sueldo. */
  benefitsBaseSalaryCents: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  effectiveHalf: 1 | 2;
  notes: string | null;
  createdAt: string;
}

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
  | "otro"
  /** Viajes de InDrive (transporte) — se registran en su propio tab. */
  | "indrive";

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
export type LoanPaymentMethod = "cuota_fija" | "cuota_variable";

/** Lo que se financia a cuotas: dinero (préstamo/adelanto) o una compra
 *  (herramienta) / un cobro (daño). */
export type LoanCategory = "prestamo" | "adelanto" | "herramienta" | "dano";

export interface PayrollLoan {
  id: string;
  employeeId: string;
  category: LoanCategory;
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

/** Una fila del pivot de Resumen Anual: totales de un empleado a lo
 *  largo de las 24 quincenas de un año, más el total anual. Portado de
 *  Atlas `EmployeeAnnualSummary`. */
export interface PayrollEmployeeAnnualSummary {
  employee: PayrollEmployee;
  /** Keyed "month-half", ej. "3-1" para la 1ra quincena de marzo. */
  totalsByPeriod: Record<string, number>;
  totalPaidCents: number;
  conceptTotals: {
    salarioCents: number;
    decimoCents: number;
    vacacionCents: number;
    primaCents: number;
    descuentosCents: number;
    prestamosCents: number;
  };
  /** Meses (1-12) con al menos una entry real este año. */
  monthsWithActivity: number;
  /** Suma de totalCents en quincenas con entry.paid === true. */
  paidCents: number;
  /** Meses donde toda entry real de ese mes tiene paid === true. */
  monthsPaid: number;
}

// ── Auditoría ──────────────────────────────────────────────────────────

export interface AuditoriaLineItem {
  key: string;
  /** Clave i18n de `strings.planilla` para la etiqueta. */
  labelKey: string;
  /** 24 valores, en orden PERIODS_IN_YEAR (Ene-1Q…Dic-2Q). */
  periods: number[];
  totalCents: number;
  /** Valor de acumulado por quincena (Décimo/Vacación/Prima) para el
   *  toggle "Proyección de prestaciones" — nunca suma al total. */
  previewPeriods?: number[];
  /** Línea solo informativa (Caja de Seguro Social): se muestra pero no
   *  cuenta en periods/totalCents del grupo. */
  excludeFromSubtotal?: boolean;
}

export interface AuditoriaConceptGroup {
  key: string;
  labelKey: string;
  periods: number[];
  totalCents: number;
  lineItems: AuditoriaLineItem[];
}

export interface AuditoriaEmployeeRow {
  employee: PayrollEmployee;
  periods: number[];
  totalCents: number;
  /** Quincena base pura por quincena — misma serie que la 1ra línea del
   *  grupo Salarios; duplicada acá para la comparación Total-vs-Base. */
  basePeriods: number[];
  groups: AuditoriaConceptGroup[];
}

export type AuditFindingKind = "paid_zero" | "negative" | "gap";

/** Hallazgo estructurado (sin texto): la vista lo formatea con el idioma
 *  activo. Cruza la frontera server→client como datos planos. */
export interface AuditFinding {
  employeeId: string;
  employeeName: string;
  severity: "warning" | "error";
  kind: AuditFindingKind;
  year: number;
  /** paid_zero / negative: quincena señalada. */
  month?: number;
  half?: 1 | 2;
  totalCents?: number;
  /** gap: meses entre los que falta actividad. */
  monthA?: number;
  monthB?: number;
}

export interface AuditoriaData {
  rows: AuditoriaEmployeeRow[];
  periodTotals: number[];
  grandTotalCents: number;
  findings: AuditFinding[];
}

// ── Dashboard / obligaciones ──────────────────────────────────────────

export interface UpcomingObligations {
  decimoPendingCents: number;
  decimoDueDate: string;
  vacacionPendingCents: number;
  prestamosPendingCents: number;
  employeesWithLoanBalance: number;
}

/** Un viaje de InDrive (transporte) del empleado. */
export interface IndriveRide {
  id: string;
  employeeId: string;
  rideDate: string;
  amountCents: number;
  /** ¿Se le cobra al empleado? Siempre queda en el historial. */
  charge: boolean;
  notes: string | null;
  /** Quincena del viaje (la que contiene su fecha). */
  period: { year: number; month: number; half: 1 | 2 };
  /** Cobrado y la quincena ya se pagó: ya no se puede cambiar el cobro. */
  locked: boolean;
}
