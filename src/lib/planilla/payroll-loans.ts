import type { Period } from "@/lib/planilla/payroll-period";
import { nextPeriod } from "@/lib/planilla/payroll-period";
import type { LoanPaymentMethod } from "@/types/planilla";

export type { LoanPaymentMethod };

export interface LoanScheduleInstallment {
  period: Period;
  amountCents: number;
}

/**
 * Portado TAL CUAL de Atlas (Life OS) `src/lib/home/payroll-loans.ts`.
 *
 * Parte el principal de un préstamo en `numInstallments` cuotas, una por
 * quincena consecutiva empezando en `startPeriod`. El único
 * `paymentMethod` hoy es "cuota_fija" — cuotas iguales (ej. $200 en 8
 * quincenas = $25/quincena), igual que la columna "Descuento de
 * Prestamo"/"Descuento de Adelantos" de la hoja "Ebony - Planilla 2026".
 * Redondea cada cuota hacia abajo al centavo y mete lo que deja la
 * división en la ÚLTIMA cuota, así la suma de todas las cuotas es
 * siempre exactamente `principalCents` — nunca un centavo perdido o
 * inventado por redondear cada quincena por separado.
 */
export function computeLoanSchedule(
  principalCents: number,
  numInstallments: number,
  startPeriod: Period,
  paymentMethod: LoanPaymentMethod = "cuota_fija"
): LoanScheduleInstallment[] {
  if (numInstallments < 1) throw new Error("numInstallments debe ser al menos 1");
  if (paymentMethod !== "cuota_fija") {
    throw new Error(`Esquema de pago no soportado: ${paymentMethod}`);
  }
  const base = Math.floor(principalCents / numInstallments);
  const remainder = principalCents - base * numInstallments;
  const installments: LoanScheduleInstallment[] = [];
  let period = startPeriod;
  for (let i = 0; i < numInstallments; i++) {
    const isLast = i === numInstallments - 1;
    installments.push({ period, amountCents: isLast ? base + remainder : base });
    period = nextPeriod(period);
  }
  return installments;
}

/**
 * Dónde debería caer por default la primera (o única) cuota de un
 * préstamo/adelanto, a partir de la fecha en que se solicitó/otorgó —
 * mismo mapeo día<=15 -> 1a mitad / día>15 -> 2a mitad que todo el
 * resto de la Planilla. Un **adelanto** cae por default en la quincena
 * que ya CONTIENE la fecha de solicitud (un adelanto se pide antes del
 * pago de esa quincena — ej. solicitado el 20 de agosto, se descuenta
 * de la quincena del 30, que es la 2a mitad de agosto = la misma que
 * contiene el 20). Un **préstamo** cae por default en la quincena
 * SIGUIENTE, así plata entregada a mitad de quincena no intenta también
 * clavar parte de una quincena cuyo monto quizás ya está cerca del
 * pago. Ambos son overrides editables en el diálogo, nunca forzados.
 */
export function defaultLoanStartPeriod(category: "prestamo" | "adelanto", requestDate: string): Period | null {
  const d = new Date(requestDate);
  if (Number.isNaN(d.getTime())) return null;
  const requestPeriod: Period = { year: d.getFullYear(), month: d.getMonth() + 1, half: d.getDate() <= 15 ? 1 : 2 };
  return category === "adelanto" ? requestPeriod : nextPeriod(requestPeriod);
}

/** La última quincena que toca el calendario de un préstamo — "fecha
 *  estimada que se paga el préstamo", expresada como período en vez de
 *  fecha de calendario. Puramente función de los otros tres inputs —
 *  nunca se guarda, así editar numInstallments/startPeriod no puede
 *  dejar una fecha de pago vieja atrás. */
export function loanPayoffPeriod(startPeriod: Period, numInstallments: number): Period {
  let period = startPeriod;
  for (let i = 1; i < numInstallments; i++) {
    period = nextPeriod(period);
  }
  return period;
}
