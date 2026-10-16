/**
 * Asistencia: de las marcaciones del reloj y del Jotform a las horas que se
 * descuentan por llegar tarde.
 *
 * Reglas (las dictó Ebony):
 *  - Horario: lunes a viernes 7:30 a 5:00 pm; sábado 8:00 am a 1:30 pm.
 *  - Sin tolerancia: llegar después de la hora de entrada se descuenta, minuto a minuto.
 *  - Las horas extra NO salen de las marcaciones: solo cuenta lo que pasa la jefa de taller.
 *    Las marcaciones sirven para confirmar que entraron y salieron a tiempo.
 *  - Falta la salida: se asume la hora normal de salida, pero el día queda en la lista de revisión.
 *  - Sin ninguna marcación en un día laborable: no vino (se descuenta), también a revisión.
 *  - Reloj y Jotform se juntan: la mayoría entra al taller y sale desde el proyecto.
 *  - Recargo nocturno (solo quien lo tiene, hoy José Salcedo): minutos después de las 6 pm.
 *
 * Todo en minutos enteros; las horas decimales se calculan al final.
 */
import {
  DEFAULT_SCHEDULE,
  type DayFlag,
  type DayResult,
  type EmployeeAttendance,
  type RawPunch,
  type Schedule,
} from "./types";

/** Día de la semana de una fecha `YYYY-MM-DD` (0 = domingo), sin pasar por zonas horarias. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Todas las fechas entre `from` y `to` (incluidas). */
export function datesBetween(from: string, to: string): string[] {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const out: string[] = [];
  for (let t = Date.UTC(y1, m1 - 1, d1); t <= Date.UTC(y2, m2 - 1, d2); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const NOON = 12 * 60;
/** Dos marcaciones a menos de esto no son "entrada y salida" de verdad (ej. 08:13 y 08:13). */
const MIN_SHIFT = 120;

export function analyzeDay(date: string, punches: RawPunch[], schedule: Schedule = DEFAULT_SCHEDULE): DayResult {
  const weekday = weekdayOf(date);
  const isSaturday = weekday === 6;
  const start = isSaturday ? schedule.saturdayStart : schedule.weekdayStart;
  const end = isSaturday ? schedule.saturdayEnd : schedule.weekdayEnd;
  const flags: DayFlag[] = [];
  const times = punches.map((p) => p.minutes).sort((a, b) => a - b);
  const sources = [...new Set(punches.map((p) => p.source))];

  const result: DayResult = {
    date,
    weekday,
    arrival: null,
    departure: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    nightMinutes: 0,
    flags,
    sources,
  };

  if (weekday === 0) {
    if (times.length > 0) flags.push("sunday_punch");
    return result;
  }
  if (times.length === 0) {
    flags.push("absent");
    return result;
  }

  const first = times[0];
  const last = times[times.length - 1];
  if (first >= NOON) {
    // Todas las marcaciones son de tarde: no sabemos cuándo llegó (marcó al irse), no se descuenta tardanza.
    result.departure = last;
    flags.push("missing_in");
    if (times.length === 1 || last - first < MIN_SHIFT) flags.push("unclear");
  } else if (times.length === 1 || last - first < MIN_SHIFT) {
    // Una sola marcación de mañana (o dos casi iguales, ej. 08:13 y 08:13): la entrada; falta la salida.
    result.arrival = first;
    if (times.length > 1) flags.push("unclear");
    flags.push("missing_out");
  } else {
    result.arrival = first;
    result.departure = last;
  }

  if (result.arrival !== null) result.lateMinutes = Math.max(0, result.arrival - start);
  if (result.departure !== null) {
    result.earlyLeaveMinutes = Math.max(0, end - result.departure);
    if (result.earlyLeaveMinutes > 0) flags.push("early_leave");
    result.nightMinutes = Math.max(0, result.departure - schedule.nightFrom);
  }
  return result;
}

/** Marcaciones de una quincena de UN empleado, ya juntas de las dos fuentes. */
export function analyzePeriod(
  from: string,
  to: string,
  punches: RawPunch[],
  schedule: Schedule = DEFAULT_SCHEDULE,
  /** Días en que la persona trabaja en la empresa (ingreso / salida): fuera de ahí no hay ausencias. */
  employment: { startDate?: string | null; endDate?: string | null } = {}
): EmployeeAttendance {
  const byDate = new Map<string, RawPunch[]>();
  for (const p of punches) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const days = datesBetween(from, to)
    .filter((d) => !(employment.startDate && d < employment.startDate) && !(employment.endDate && d > employment.endDate))
    .map((d) => analyzeDay(d, byDate.get(d) ?? [], schedule));
  const review = days.filter((d) => d.flags.some((f) => f !== "early_leave" && f !== "sunday_punch")).map((d) => ({ date: d.date, flags: d.flags }));
  return {
    days,
    lateMinutes: days.reduce((s, d) => s + d.lateMinutes, 0),
    absentWeekdays: days.filter((d) => d.flags.includes("absent") && d.weekday >= 1 && d.weekday <= 5).length,
    absentSaturdays: days.filter((d) => d.flags.includes("absent") && d.weekday === 6).length,
    earlyLeaveMinutes: days.reduce((s, d) => s + d.earlyLeaveMinutes, 0),
    nightMinutes: days.reduce((s, d) => s + d.nightMinutes, 0),
    review,
  };
}

/** Minutos a horas con 2 decimales (lo que se escribe en "Horas descontadas"). */
export const minutesToHours = (m: number) => Math.round((m / 60) * 100) / 100;

/**
 * Recargo nocturno de quien lo tiene: horas después de las 6 pm × 1.5 × valor
 * de la hora (sueldo mensual / 240). En centavos. Va en bonificación; las horas
 * mismas se pagan como extras con el formulario de la jefa de taller.
 */
export function nightSurchargeCents(nightMinutes: number, monthlySalaryCents: number): number {
  const hourly = monthlySalaryCents / 240;
  return Math.round((nightMinutes / 60) * 1.5 * hourly);
}
