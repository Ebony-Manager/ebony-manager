/**
 * El corazón de cálculo de la Planilla: total de quincena, Décimo,
 * Vacación Proporcional y Prima de Antigüedad.
 *
 * Portado de Atlas (Life OS) `src/services/payroll.ts`. En Atlas estas
 * funciones vivían en el servicio (server-only, SQLite); acá se
 * extraen a la capa `lib/` porque son PURAS — no tocan la base de
 * datos, solo reciben:
 *   - un `PeriodTotalLookup` (período -> PayrollPeriodTotal), o
 *   - arrays de PayrollEntry / filas de ledger ya cargadas.
 * El servicio (`src/services/payroll.ts`) es el que hace los queries a
 * Supabase y le pasa esos datos a estas funciones. Así la fórmula nunca
 * cambia entre "camino lento" y "camino rápido" y se puede probar sin DB.
 *
 * Reglas de negocio reusadas de Atlas (no se tocan):
 *   - Dinero en centavos enteros.
 *   - Ningún total se guarda; todo se computa al leer.
 *   - Décimo: segmentos fijos de Panamá (16-abr, 16-ago, 16-dic), pago
 *     del segmento a la fecha / 12.
 *   - Vacación: 9.09% (1/11) de lo pagado desde el último pago real de
 *     vacación; reinicia la quincena siguiente a un pago.
 *   - Prima de Antigüedad: 1.92% del salario mensual por mes cumplido
 *     desde el ingreso (o desde una liquidación registrada).
 */
import type { PayrollEmployee, PayrollEntry, PayrollPeriodTotal } from "@/types/planilla";
import { currentPeriod, nextPeriod, periodOrdinal, type Period } from "@/lib/planilla/payroll-period";

/** Un período -> total. Lo satisface tanto un array de entries cargado
 *  en memoria (`buildEmployeeContext`) como, en el servicio, un fetch a
 *  Supabase. Ambos comparten `computePeriodTotalFromEntry`. */
export type PeriodTotalLookup = (p: Period) => PayrollPeriodTotal;

/** Fila de ledger ya filtrada (sin `seguro_social`, que es informativo)
 *  y mapeada a camelCase — lo que `buildEmployeeContext` necesita para
 *  plegar deudas/abonos en el total de cada quincena. */
export interface LedgerRowLite {
  direction: "debt" | "payment";
  amountCents: number;
  payrollEntryId: string | null;
  /** Solo con `datedLedger`: ubica en su quincena (por fecha) lo que no
   *  está atado a una (ej. el monto de un préstamo o adelanto otorgado). */
  entryDate?: string;
}

/** Clave año+mes+quincena — un empleado tiene historial en varios años,
 *  así que el lookup en memoria necesita el año en la clave. */
function fullPeriodKey(p: Period): string {
  return `${p.year}-${p.month}-${p.half}`;
}

// ============================================================================
// Total de quincena
// ============================================================================

/** La fórmula del total de una quincena. Compartida por el camino de
 *  fetch-por-llamada y el batcheado en memoria, así el total nunca
 *  drifta entre los dos. */
export function computePeriodTotalFromEntry(
  entry: PayrollEntry | null,
  ledger: { debt: number; payment: number }
): PayrollPeriodTotal {
  if (!entry) {
    return { entry: null, ledgerDebtCents: ledger.debt, ledgerPaymentCents: ledger.payment, totalCents: 0 };
  }
  const totalCents =
    entry.basePayCents +
    entry.extraHoursCents +
    entry.extraDaysCents +
    entry.viaticosCents +
    entry.bonusCents +
    entry.diasLibresCents +
    entry.decimoPaidCents +
    entry.vacationPaidCents +
    entry.primaAntiguedadPaidCents -
    entry.horasDescontadasCents -
    entry.diasDescontadosCents -
    entry.otherDeductionCents -
    ledger.payment;
  return { entry, ledgerDebtCents: ledger.debt, ledgerPaymentCents: ledger.payment, totalCents };
}

/** El salario REALMENTE ganado en una quincena — base, extras y días
 *  libres, menos descuentos — EXCLUYENDO a propósito el pago de
 *  décimo/vacación de esa misma quincena (contarlo acá haría que un
 *  décimo/vacación pagado cuente como salario regular hacia el SIGUIENTE
 *  acumulado — un bug de décimo-sobre-décimo). También excluye abonos
 *  de ledger: un abono a préstamo baja el take-home, no el salario
 *  elegible para prestaciones. */
function salaryCompensationCents(entry: PayrollEntry): number {
  return (
    entry.basePayCents +
    entry.extraHoursCents +
    entry.extraDaysCents +
    entry.viaticosCents +
    entry.bonusCents +
    entry.diasLibresCents -
    entry.horasDescontadasCents -
    entry.diasDescontadosCents -
    entry.otherDeductionCents
  );
}

/** El monto que le toca a una quincena para una fórmula de acumulado —
 *  el salario real (`salaryCompensationCents`) cuando no se da una base
 *  alterna, o medio mes plano de esa base alterna cuando sí (solo para
 *  quincenas con entry real — ver la fila "Acumulado a 500" de la hoja,
 *  que incrementa a tarifa plana solo en meses efectivamente trabajados). */
function accrualAmountForPeriod(
  lookup: PeriodTotalLookup,
  p: Period,
  benefitsBaseCents?: number,
  projectFutureBaseCents?: number
): number {
  const total = lookup(p);
  if (total.entry) {
    return benefitsBaseCents === undefined ? salaryCompensationCents(total.entry) : Math.round(benefitsBaseCents / 2);
  }
  // Sin entry real para esta quincena. Huecos pasados/actuales (un
  // empleado aún no contratado, un mes real en que simplemente no se le
  // pagó) quedan en 0 — nunca se fabrican. Una quincena que todavía no
  // pasó recibe un estimado plano de medio mes SOLO cuando el caller
  // pidió proyectar (toggle "Proyectar próximos meses").
  if (projectFutureBaseCents !== undefined) {
    const current = currentPeriod();
    const isFuture = periodOrdinal(p.year, p.month, p.half) > periodOrdinal(current.year, current.month, current.half);
    if (isFuture) return Math.round(projectFutureBaseCents / 2);
  }
  return 0;
}

// ============================================================================
// Décimo (13er mes)
// ============================================================================

/** Las cuotas de décimo caen en tres fechas fijas cada año (ley
 *  panameña): mediados de abril, agosto y diciembre — cada una cubre el
 *  segmento de ~4 meses (8 quincenas) desde la cuota anterior. Esto
 *  encuentra el segmento en el que `asOf` cae y devuelve su primera
 *  quincena, así el acumulado siempre empieza a contar desde el lugar
 *  correcto y aterriza en la suma exacta de 8 quincenas justo en cada
 *  fecha de cuota. */
export function decimoSegmentStart(asOf: Period): Period {
  const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
  // Las cuatro anclas que podrían ser "el inicio del segmento de asOf":
  // 16-dic del año previo, 16-abr de este año, 16-ago de este año,
  // 16-dic de ESTE año. La última es fácil de olvidar (parece redundante
  // con "16-dic del año previo" hasta que evaluás `asOf` en diciembre
  // después del 15 — ej. una cuota de diciembre proyectada) — sin ella,
  // cualquier consulta después del 15-dic seguía sumando desde el 16-ago
  // en vez de reiniciar, aterrizando un segmento (8 quincenas) de más.
  const candidates: Period[] = [
    { year: asOf.year - 1, month: 12, half: 2 },
    { year: asOf.year, month: 4, half: 2 },
    { year: asOf.year, month: 8, half: 2 },
    { year: asOf.year, month: 12, half: 2 },
  ];
  let best = candidates[0];
  let bestOrd = periodOrdinal(best.year, best.month, best.half);
  for (const c of candidates) {
    const ord = periodOrdinal(c.year, c.month, c.half);
    if (ord <= asOfOrd && ord > bestOrd) {
      best = c;
      bestOrd = ord;
    }
  }
  return best;
}

/**
 * Décimo — el pago del segmento a la fecha (desde la fecha fija de la
 * última cuota) dividido entre 12, evaluado a cualquier período, así la
 * UI puede mostrarlo creciendo cada mes hacia la próxima cuota y
 * aterrizando en la cifra exacta de 8 quincenas / 12 justo en cada
 * fecha de cuota. Pasar `benefitsBaseCents` para la pista alterna de
 * "prestaciones". Puramente computado, nunca guardado.
 */
export function computeDecimoAccrualCore(
  lookup: PeriodTotalLookup,
  asOf: Period,
  benefitsBaseCents?: number,
  projectFutureBaseCents?: number
): number {
  const start = decimoSegmentStart(asOf);
  const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
  let total = 0;
  let cur: Period = start;
  while (periodOrdinal(cur.year, cur.month, cur.half) <= asOfOrd) {
    total += accrualAmountForPeriod(lookup, cur, benefitsBaseCents, projectFutureBaseCents);
    cur = nextPeriod(cur);
  }
  return Math.round(total / 12);
}

// ============================================================================
// Vacación Proporcional
// ============================================================================

/**
 * Vacaciones proporcionales — 9.09% (1/11) de todo lo pagado desde la
 * última vez que se pagó vacación de verdad (no un año calendario fijo,
 * y no todo el historial), evaluado a cualquier período. Reinicia la
 * quincena justo después de un pago real y vuelve a acumular. Pasar
 * `benefitsBaseCents` para la pista alterna de "prestaciones".
 */
export function computeVacationAccrualCore(
  periodsWithEntries: Period[],
  lastPayout: Period | null,
  lookup: PeriodTotalLookup,
  asOf: Period,
  benefitsBaseCents?: number,
  projectFutureBaseCents?: number
): number {
  const lastPayoutOrd = lastPayout ? periodOrdinal(lastPayout.year, lastPayout.month, lastPayout.half) : -Infinity;
  const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
  const realPeriods = periodsWithEntries.filter((p) => {
    const ord = periodOrdinal(p.year, p.month, p.half);
    return ord > lastPayoutOrd && ord <= asOfOrd;
  });
  let total = realPeriods.reduce((sum, p) => sum + accrualAmountForPeriod(lookup, p, benefitsBaseCents), 0);

  // Las quincenas reales solo existen hasta "hoy" — un asOf futuro (el
  // toggle de proyección mirando Sep-Dic, digamos) si no, dejaría de
  // crecer justo en la última entry real. Se agrega medio mes plano por
  // quincena proyectada desde ahí (o desde el último pago, o desde
  // "ahora", lo que sea más tarde) hasta asOf.
  if (projectFutureBaseCents !== undefined) {
    const current = currentPeriod();
    const currentOrd = periodOrdinal(current.year, current.month, current.half);
    const last = realPeriods[realPeriods.length - 1];
    const lastCountedOrd = last ? periodOrdinal(last.year, last.month, last.half) : lastPayoutOrd;
    for (let ord = Math.max(lastCountedOrd, currentOrd) + 1; ord <= asOfOrd; ord++) {
      total += Math.round(projectFutureBaseCents / 2);
    }
  }
  return Math.round(total * 0.0909);
}

// ============================================================================
// Prima de Antigüedad
// ============================================================================

/** Fecha de calendario aproximada de una quincena — el 15 para la 1a
 *  mitad, el 28 para la 2a — para la matemática de contar meses de
 *  Prima de Antigüedad. La misma aproximación en ambos lados de la
 *  comparación, así queda consistente sin importar a cuál se aplica
 *  (fecha de ingreso, período de una liquidación real, o `asOf`). */
export function periodApproxDate(p: Period): Date {
  return new Date(p.year, p.month - 1, p.half === 1 ? 15 : 28);
}

/** Un string de fecha (ej. `employee.endDate`) convertido al Período en
 *  que cae, para compararlo contra `asOf` igual que cualquier otra
 *  ancla basada en período. Día 1-15 -> mitad 1, 16-fin -> mitad 2. */
export function periodFromDateString(dateStr: string): Period | null {
  // "YYYY-MM-DD" se lee tal cual, sin pasar por `new Date`: ese constructor
  // lo interpreta como medianoche UTC, y en un servidor al oeste de UTC
  // (ej. EST) el 1° de enero cae en el 31 de diciembre del año anterior.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return { year: Number(m[1]), month: Number(m[2]), half: Number(m[3]) <= 15 ? 1 : 2 };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, half: d.getDate() <= 15 ? 1 : 2 };
}

/** Lo que hace falta para calcular la prima sobre lo REALMENTE pagado. */
export interface PrimaAccrualOptions {
  /** Último pago real de prima estrictamente antes de `asOf`: el reloj
   *  reinicia en la quincena siguiente, igual que la vacación. */
  lastPayout?: Period | null;
  /** Suma y cantidad de las compensaciones (salario realmente ganado) de las
   *  quincenas con entry entre `fromOrdExclusive` y `toOrd` (incluida). */
  compensation?: (fromOrdExclusive: number, toOrd: number) => { sumCents: number; count: number };
}

/**
 * Prima de Antigüedad — Código de Trabajo Art. 196 / Ley 44 de 1995:
 * una semana de salario por año completo de servicio, que la provisión
 * mensual estándar expresa como 1.92% del salario mensual por mes
 * trabajado. Se cuenta en meses calendario desde `employee.startDate`
 * por default; una liquidación registrada (`resetAnchor`) o un pago real de
 * prima (`opts.lastPayout`) reinician el reloj: los meses se cuentan desde
 * ahí, igual que Décimo/Vacación reinician después de un pago.
 *
 * El salario de referencia es el PAGADO: el promedio mensual de lo realmente
 * ganado (base + extras − horas/días descontados) en las quincenas con
 * entry dentro de esa ventana, tomada hasta el último mes completo (así solo
 * cambia una vez al mes). Si no hay ninguna, cae al salario base.
 * Piso a meses enteros.
 */
export function computePrimaAntiguedadAccrualCore(
  employee: PayrollEmployee,
  asOf: Period,
  resetAnchor: Period | null,
  opts: PrimaAccrualOptions = {}
): number {
  const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
  const ord = (p: Period) => periodOrdinal(p.year, p.month, p.half);

  let anchor: Date | null = null;
  let anchorOrdExclusive = -Infinity;
  if (employee.startDate) {
    const d = new Date(employee.startDate);
    const sp = periodFromDateString(employee.startDate);
    if (!Number.isNaN(d.getTime()) && sp) {
      anchor = d;
      anchorOrdExclusive = ord(sp) - 1;
    }
  }
  const restarts: Period[] = [];
  if (resetAnchor && asOfOrd > ord(resetAnchor)) restarts.push(resetAnchor);
  if (opts.lastPayout && ord(opts.lastPayout) < asOfOrd) restarts.push(opts.lastPayout);
  for (const r of restarts) {
    // Un reinicio solo adelanta el ancla; nunca la retrocede.
    if (ord(r) > anchorOrdExclusive) {
      anchor = periodApproxDate(r);
      anchorOrdExclusive = ord(r);
    }
  }
  if (!anchor) return 0;

  const asOfApproxDate = periodApproxDate(asOf);
  let months =
    (asOfApproxDate.getFullYear() - anchor.getFullYear()) * 12 + (asOfApproxDate.getMonth() - anchor.getMonth());
  if (asOfApproxDate.getDate() < anchor.getDate()) months -= 1;
  months = Math.max(0, months);

  // El promedio pagado se toma hasta el último MES COMPLETO (hasta la 2da
  // quincena): así la prima avanza una vez al mes, junto con los meses
  // cumplidos, y no sube y baja con cada quincena que trae un descuento.
  let monthlyCents = employee.baseSalaryCents;
  if (opts.compensation) {
    const windowEndOrd = asOf.half === 2 ? asOfOrd : asOfOrd - 1;
    const { sumCents, count } = opts.compensation(anchorOrdExclusive, windowEndOrd);
    if (count > 0) monthlyCents = Math.round((sumCents / count) * 2);
  }
  return Math.round(monthlyCents * 0.0192 * months);
}

/** Wrapper puro: deriva el `resetAnchor` de `employee.endDate` y llama
 *  al core. Igual que el `computePrimaAntiguedadAccrual` de Atlas. */
export function computePrimaAntiguedadAccrual(
  employee: PayrollEmployee,
  asOf: Period,
  opts: PrimaAccrualOptions = {}
): number {
  const resetAnchor = employee.endDate ? periodFromDateString(employee.endDate) : null;
  return computePrimaAntiguedadAccrualCore(employee, asOf, resetAnchor, opts);
}

// ============================================================================
// Contexto batcheado de un empleado (parte pura de loadEmployeeContext)
// ============================================================================

export interface EmployeeAccrualContext {
  lookup: PeriodTotalLookup;
  periodsWithEntries: Period[];
  /** El pago de vacación más reciente ESTRICTAMENTE antes de `asOf` —
   *  null si nunca hubo (el acumulado arranca desde la primera entry).
   *  Estricto (`<`, no `<=`) a propósito: si `asOf` es un período de
   *  pago, ese pago no ocurrió "antes" de él, ocurre EN él; la suma
   *  desde el pago previo hasta e incluyendo `asOf` es justo lo que esa
   *  cuota representa. Con `<=` el acumulado daba 0 exactamente en el
   *  único momento que necesitaba igualar el monto pagado real. */
  lastVacationPayout: (asOf: Period) => Period | null;
  /** Igual que `lastVacationPayout`, para la prima de antigüedad. */
  lastPrimaPayout: (asOf: Period) => Period | null;
  /** Salario realmente ganado (sin décimo/vacación/prima pagados ni abonos de
   *  préstamo) de las quincenas con entry en (`fromOrdExclusive`, `toOrd`]. */
  compensation: (fromOrdExclusive: number, toOrd: number) => { sumCents: number; count: number };
}

/**
 * Toma TODO el historial de un empleado (arrays de PayrollEntry +
 * filas de ledger ya filtradas/mapeadas) y arma los lookups en memoria
 * que las funciones core de arriba pueden recorrer sin volver a la DB.
 * Es la parte pura de `loadEmployeeContext` de Atlas. Comparte
 * `computePeriodTotalFromEntry` con el camino de fetch-por-llamada, así
 * el total nunca drifta entre los dos.
 */
export function buildEmployeeContext(
  entries: PayrollEntry[],
  ledgerRows: LedgerRowLite[],
  /** Estado de cuenta: los movimientos sin quincena cuentan en la quincena
   *  de su fecha (solo en las columnas de préstamos; nunca en el neto). */
  opts: { datedLedger?: boolean } = {},
): EmployeeAccrualContext {
  const ledgerByEntryId = new Map<string, { debt: number; payment: number }>();
  const datedByPeriod = new Map<string, { debt: number; payment: number }>();
  for (const row of ledgerRows) {
    if (!row.payrollEntryId) {
      const p = opts.datedLedger && row.entryDate ? periodFromDateString(row.entryDate) : null;
      if (p) {
        const acc = datedByPeriod.get(fullPeriodKey(p)) ?? { debt: 0, payment: 0 };
        if (row.direction === "payment") acc.payment += row.amountCents;
        else acc.debt += row.amountCents;
        datedByPeriod.set(fullPeriodKey(p), acc);
      }
      continue;
    }
    const acc = ledgerByEntryId.get(row.payrollEntryId) ?? { debt: 0, payment: 0 };
    if (row.direction === "payment") acc.payment += row.amountCents;
    else acc.debt += row.amountCents;
    ledgerByEntryId.set(row.payrollEntryId, acc);
  }

  // Orden cronológico ascendente — defensivo, por si el caller no lo
  // ordenó (Atlas lo garantizaba con ORDER BY en el query).
  const sorted = [...entries].sort(
    (a, b) =>
      periodOrdinal(a.periodYear, a.periodMonth, a.periodHalf) -
      periodOrdinal(b.periodYear, b.periodMonth, b.periodHalf)
  );

  const entryByKey = new Map<string, PayrollEntry>();
  const periodsWithEntries: Period[] = [];
  const vacationPayouts: Period[] = [];
  const primaPayouts: Period[] = [];
  const compensations: { ord: number; cents: number }[] = [];
  for (const entry of sorted) {
    const p: Period = { year: entry.periodYear, month: entry.periodMonth, half: entry.periodHalf };
    entryByKey.set(fullPeriodKey(p), entry);
    periodsWithEntries.push(p);
    if (entry.vacationPaidCents > 0) vacationPayouts.push(p);
    if (entry.primaAntiguedadPaidCents > 0) primaPayouts.push(p);
    compensations.push({ ord: periodOrdinal(p.year, p.month, p.half), cents: salaryCompensationCents(entry) });
  }
  // `sorted` es ascendente, así que vacationPayouts también — se
  // invierte para que lastVacationPayout tome el primero estrictamente
  // antes de asOf que encuentre (más reciente primero).
  vacationPayouts.reverse();
  primaPayouts.reverse();

  const lookup: PeriodTotalLookup = (p) => {
    const entry = entryByKey.get(fullPeriodKey(p)) ?? null;
    const ledger = entry ? (ledgerByEntryId.get(entry.id) ?? { debt: 0, payment: 0 }) : { debt: 0, payment: 0 };
    const total = computePeriodTotalFromEntry(entry, ledger);
    const dated = datedByPeriod.get(fullPeriodKey(p));
    // Fuera del neto a propósito: no se descontó en la planilla.
    return dated
      ? { ...total, ledgerDebtCents: total.ledgerDebtCents + dated.debt, ledgerPaymentCents: total.ledgerPaymentCents + dated.payment }
      : total;
  };

  const lastVacationPayout = (asOf: Period): Period | null => {
    const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
    for (const p of vacationPayouts) {
      if (periodOrdinal(p.year, p.month, p.half) < asOfOrd) return p;
    }
    return null;
  };

  const lastPrimaPayout = (asOf: Period): Period | null => {
    const asOfOrd = periodOrdinal(asOf.year, asOf.month, asOf.half);
    for (const p of primaPayouts) {
      if (periodOrdinal(p.year, p.month, p.half) < asOfOrd) return p;
    }
    return null;
  };

  const compensation = (fromOrdExclusive: number, toOrd: number) => {
    let sumCents = 0;
    let count = 0;
    for (const c of compensations) {
      if (c.ord > fromOrdExclusive && c.ord <= toOrd) {
        sumCents += c.cents;
        count += 1;
      }
    }
    return { sumCents, count };
  };

  return { lookup, periodsWithEntries, lastVacationPayout, lastPrimaPayout, compensation };
}

// ============================================================================
// Wrappers ergonómicos: reciben arrays ya cargados
// ============================================================================

/** Décimo a partir de un array de entries ya cargado (lo que el
 *  servicio traerá de Supabase). El ledger no afecta el acumulado de
 *  décimo (se recalcula desde los campos del entry), así que este
 *  wrapper no lo necesita. */
export function computeDecimoAccrual(
  entries: PayrollEntry[],
  asOf: Period,
  benefitsBaseCents?: number,
  projectFutureBaseCents?: number
): number {
  const ctx = buildEmployeeContext(entries, []);
  return computeDecimoAccrualCore(ctx.lookup, asOf, benefitsBaseCents, projectFutureBaseCents);
}

/** Vacación proporcional a partir de un array de entries ya cargado.
 *  Deriva el último pago desde los propios entries (`vacationPaidCents
 *  > 0`). */
export function computeVacationAccrual(
  entries: PayrollEntry[],
  asOf: Period,
  benefitsBaseCents?: number,
  projectFutureBaseCents?: number
): number {
  const ctx = buildEmployeeContext(entries, []);
  return computeVacationAccrualCore(
    ctx.periodsWithEntries,
    ctx.lastVacationPayout(asOf),
    ctx.lookup,
    asOf,
    benefitsBaseCents,
    projectFutureBaseCents
  );
}

// ============================================================================
// Detalle anual de un empleado (parte pura de getEmployeeAnnualDetail)
// ============================================================================

export const PERIODS_IN_YEAR: Array<{ month: number; half: 1 | 2 }> = Array.from(
  { length: 12 },
  (_, i) => i + 1
).flatMap((month) => [
  { month, half: 1 as const },
  { month, half: 2 as const },
]);

export interface AnnualDetailRow extends PayrollPeriodTotal {
  year: number;
  month: number;
  half: 1 | 2;
  runningLedgerBalanceCents: number;
  decimoAccrualCents: number;
  vacationAccrualCents: number;
  decimoAccrualBenefitsCents: number | null;
  vacationAccrualBenefitsCents: number | null;
  primaAntiguedadAccrualCents: number;
}

/**
 * El ledger de un año completo de un empleado para la vista Detalle —
 * cada quincena del año con su desglose, la actividad de ledger de esa
 * quincena, el saldo corriente justo después, y el acumulado de
 * Décimo/Vacación/Prima a esa quincena (pista real + la alterna de
 * "prestaciones" cuando el empleado tiene una).
 *
 * Parte pura de `getEmployeeAnnualDetail` de Atlas: recibe el `employee`
 * y el `context` (que el servicio arma con 2-3 queries a Supabase) y
 * hace todo el resto en memoria.
 *
 * Una liquidación real (`employee.endDate`, marcada por el usuario)
 * detiene el acumulado de las tres prestaciones para cualquier quincena
 * estrictamente posterior, HASTA que el empleado vuelve a tener una
 * entry real — cubre tanto una terminación permanente como una
 * liquidación a mitad de tenencia donde la persona sigue trabajando.
 */
export function computeAnnualDetail(
  employee: PayrollEmployee,
  context: EmployeeAccrualContext,
  year: number,
  projectFuture = false
): AnnualDetailRow[] {
  const benefitsEnabled = employee.benefitsEnabled !== false;
  const hasBenefitsBase =
    benefitsEnabled &&
    employee.benefitsBaseSalaryCents != null &&
    employee.benefitsBaseSalaryCents !== employee.baseSalaryCents;
  // Mismo guard que la proyección de Salario Base de Resumen Anual: solo
  // un empleado activo con salario base real tiene algo sensato que
  // extrapolar.
  const canProject = projectFuture && employee.status === "ACTIVE" && (employee.baseSalaryCents ?? 0) > 0;
  const realProjectionBase = canProject ? employee.baseSalaryCents : undefined;
  const benefitsProjectionBase = canProject && hasBenefitsBase ? employee.benefitsBaseSalaryCents! : undefined;

  const liquidationAnchor = employee.endDate ? periodFromDateString(employee.endDate) : null;
  const liquidationOrd = liquidationAnchor
    ? periodOrdinal(liquidationAnchor.year, liquidationAnchor.month, liquidationAnchor.half)
    : null;

  let runningBalance = 0;
  return PERIODS_IN_YEAR.map(({ month, half }) => {
    const asOf: Period = { year, month, half };
    const total = context.lookup(asOf);
    runningBalance += total.ledgerDebtCents - total.ledgerPaymentCents;
    const lastPayout = context.lastVacationPayout(asOf);
    const asOfOrd = periodOrdinal(year, month, half);
    const pastLiquidation = liquidationOrd !== null && asOfOrd > liquidationOrd;
    const hasResumedByHere =
      pastLiquidation &&
      context.periodsWithEntries.some((p) => {
        const ord = periodOrdinal(p.year, p.month, p.half);
        return ord > liquidationOrd! && ord <= asOfOrd;
      });
    const inLiquidationGap = pastLiquidation && !hasResumedByHere;
    // Sin prestaciones (empleado que no las lleva) o en un hueco de liquidación: acumulado en 0.
    const accrualOff = inLiquidationGap || !benefitsEnabled;

    // Proyección: una quincena futura sin entry real tiene totalCents en
    // 0 — se parte el salario mensual entre sus dos quincenas como
    // estimado. Una entry real, ya registrada, siempre gana sobre esto.
    const projectedTotal: PayrollPeriodTotal =
      canProject && !total.entry && !inLiquidationGap
        ? { ...total, totalCents: Math.round(realProjectionBase! / 2) }
        : total;

    return {
      year,
      month,
      half,
      ...projectedTotal,
      runningLedgerBalanceCents: runningBalance,
      decimoAccrualCents: accrualOff
        ? 0
        : computeDecimoAccrualCore(context.lookup, asOf, undefined, realProjectionBase),
      vacationAccrualCents: accrualOff
        ? 0
        : computeVacationAccrualCore(
            context.periodsWithEntries,
            lastPayout,
            context.lookup,
            asOf,
            undefined,
            realProjectionBase
          ),
      decimoAccrualBenefitsCents: hasBenefitsBase
        ? accrualOff
          ? 0
          : computeDecimoAccrualCore(context.lookup, asOf, employee.benefitsBaseSalaryCents!, benefitsProjectionBase)
        : null,
      vacationAccrualBenefitsCents: hasBenefitsBase
        ? accrualOff
          ? 0
          : computeVacationAccrualCore(
              context.periodsWithEntries,
              lastPayout,
              context.lookup,
              asOf,
              employee.benefitsBaseSalaryCents!,
              benefitsProjectionBase
            )
        : null,
      primaAntiguedadAccrualCents:
        !accrualOff
          ? computePrimaAntiguedadAccrualCore(employee, asOf, liquidationAnchor, {
              lastPayout: context.lastPrimaPayout(asOf),
              compensation: context.compensation,
            })
          : 0,
    };
  });
}
