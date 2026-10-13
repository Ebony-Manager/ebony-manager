import type { Period } from "@/lib/planilla/payroll-period";
import { nextPeriod, periodOrdinal } from "@/lib/planilla/payroll-period";
import type { LoanCategory, LoanPaymentMethod } from "@/types/planilla";

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
  paymentMethod: LoanPaymentMethod = "cuota_fija",
  /** Solo para "cuota_variable": el monto de cada cuota, en orden. Deben
   *  sumar exactamente el principal. */
  amountsCents?: number[]
): LoanScheduleInstallment[] {
  if (numInstallments < 1) throw new Error("numInstallments debe ser al menos 1");
  if (paymentMethod === "cuota_variable") {
    if (!amountsCents || amountsCents.length !== numInstallments) {
      throw new Error("Cuota variable: falta el monto de alguna cuota");
    }
    if (amountsCents.some((a) => !Number.isInteger(a) || a <= 0)) {
      throw new Error("Cuota variable: cada cuota debe ser mayor que cero");
    }
    const total = amountsCents.reduce((s, a) => s + a, 0);
    if (total !== principalCents) {
      throw new Error("Cuota variable: las cuotas deben sumar exactamente el monto del préstamo");
    }
    let p = startPeriod;
    return amountsCents.map((amountCents) => {
      const item = { period: p, amountCents };
      p = nextPeriod(p);
      return item;
    });
  }
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
export function defaultLoanStartPeriod(category: LoanCategory, requestDate: string): Period | null {
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

// ============================================================================
// Cuotas flexibles: reflow del calendario tras editar una cuota pendiente
// ============================================================================

/** Una cuota PENDIENTE (no pagada) del calendario de un préstamo, tal
 *  como existe hoy — con su fila real de ledger. Las cuotas ya pagadas
 *  ni siquiera entran acá: viven aparte, inmutables. */
export interface PendingInstallment {
  ledgerEntryId: string;
  period: Period;
  amountCents: number;
}

/** El nuevo calendario de cuotas pendientes tras un reflow.
 *  `ledgerEntryId: null` marca una cuota NUEVA que el llamador todavía
 *  tiene que materializar (crear su `payroll_entries` + fila de ledger);
 *  el resto conserva su `ledgerEntryId` de siempre, así el llamador solo
 *  actualiza el monto. Una cuota que faltaba en el resultado (comparada
 *  contra `pending`) se borró — el reflow ya la consumió por completo. */
export interface ReflowedInstallment {
  ledgerEntryId: string | null;
  period: Period;
  amountCents: number;
}

function periodOrd(p: Period): number {
  return periodOrdinal(p.year, p.month, p.half);
}

/**
 * Reacomoda el calendario de cuotas PENDIENTES de un préstamo después de
 * editar una de ellas (`editLedgerEntryId`) a `newAmountCents` — la suma
 * de TODAS las cuotas pendientes después del reflow es SIEMPRE igual a
 * la suma de antes (el saldo pendiente nunca cambia por esto; solo lo
 * cambia una cuota que se marca `paid`, fuera de esta función).
 *
 * Las cuotas ANTERIORES a la editada (cronológicamente) nunca se tocan
 * — no deberían existir pendientes de todos modos si el tiempo avanza en
 * orden, pero por si acaso quedan intactas.
 *
 * Con `mode = "spread"` la diferencia se reparte en partes iguales entre las
 * cuotas que siguen en vez de alargar o acortar el calendario (si no hay
 * cuotas que sigan, se comporta como "extend").
 *
 *   - Cuota editada BAJA (o se salta a $0): las cuotas que siguen quedan
 *     EXACTAMENTE igual — se agrega una quincena más al final del
 *     calendario por la diferencia. Nunca se "inflan" las que siguen.
 *   - Cuota editada SUBE (un abono de más): la diferencia se descuenta
 *     de las cuotas que siguen, empezando por la MÁS TARDÍA — el
 *     préstamo se acorta (o termina de una vez), nunca se alarga. Subir
 *     más de lo que queda por cobrar de ahí en adelante se acota a ese
 *     máximo (no tiene sentido pedirle a una sola cuota más de lo que
 *     falta pagar).
 *
 * Una cuota que termina en $0 desaparece del resultado — "saltarla" es
 * simplemente que ya no esté en el calendario.
 */
export type ReflowMode = "extend" | "spread";

export function reflowLoanSchedule(
  pending: PendingInstallment[],
  editLedgerEntryId: string,
  newAmountCents: number,
  mode: ReflowMode = "extend"
): ReflowedInstallment[] {
  if (pending.length === 0) throw new Error("No hay cuotas pendientes para reacomodar");
  const sorted = [...pending].sort((a, b) => periodOrd(a.period) - periodOrd(b.period));
  const editIndex = sorted.findIndex((i) => i.ledgerEntryId === editLedgerEntryId);
  if (editIndex === -1) throw new Error("La cuota a editar no está entre las pendientes");

  // Anteriores a la editada — nunca se tocan.
  const before: ReflowedInstallment[] = sorted.slice(0, editIndex);
  const oldAmount = sorted[editIndex].amountCents;
  // Posteriores — las únicas candidatas a absorber la diferencia.
  const after = sorted.slice(editIndex + 1).map((i) => ({ ...i }));

  const availableToShift = after.reduce((sum, i) => sum + i.amountCents, 0);
  const maxAllowed = oldAmount + availableToShift;
  const clampedAmount = Math.max(0, Math.min(Math.round(newAmountCents), maxAllowed));
  const delta = clampedAmount - oldAmount;

  let tail: ReflowedInstallment[];
  if (mode === "spread" && delta !== 0 && after.length > 0) {
    // Repartir: lo que falta (o sobra) se reparte en partes iguales entre las
    // cuotas que siguen, sin agregar ni quitar quincenas. El resto de la
    // división va a la última cuota.
    const remaining = availableToShift - delta;
    const base = Math.floor(remaining / after.length);
    const rest = remaining - base * after.length;
    tail = after.map((i, idx) => ({ ...i, amountCents: idx === after.length - 1 ? base + rest : base }));
  } else if (delta < 0) {
    const shortfall = -delta;
    const lastPeriod = after.length > 0 ? after[after.length - 1].period : sorted[editIndex].period;
    tail = [...after, { ledgerEntryId: null, period: nextPeriod(lastPeriod), amountCents: shortfall }];
  } else if (delta > 0) {
    let surplus = delta;
    const reduced = [...after];
    for (let i = reduced.length - 1; i >= 0 && surplus > 0; i--) {
      if (reduced[i].amountCents <= surplus) {
        surplus -= reduced[i].amountCents;
        reduced.splice(i, 1);
      } else {
        reduced[i].amountCents -= surplus;
        surplus = 0;
      }
    }
    tail = reduced;
  } else {
    tail = after;
  }

  const edited: ReflowedInstallment = {
    ledgerEntryId: editLedgerEntryId,
    period: sorted[editIndex].period,
    amountCents: clampedAmount,
  };
  return [...before, edited, ...tail].filter((i) => i.amountCents > 0);
}
