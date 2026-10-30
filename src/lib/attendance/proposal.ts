/**
 * Propuesta de horas de una quincena: junta las marcaciones (reloj + Jotform) de
 * cada empleado y sus días revisados, aplica las reglas de `engine.ts` y las horas extra autorizadas
 * por la jefa de taller, y devuelve lo que se le sugeriría escribir en Registro.
 * Solo propone: quien llama decide qué aplicar.
 */
import { analyzePeriod, datesBetween, minutesToHours } from "./engine";
import { matchEmployees, type MatchableEmployee } from "./parse";
import type { DayFlag, DayResolution, DayResult, RawPunch, Schedule } from "./types";

export interface ProposalEmployee extends MatchableEmployee {
  status: "ACTIVE" | "INACTIVE";
  categoria: "taller" | "administrativo";
  startDate: string | null;
  endDate: string | null;
  monthlySalaryCents: number;
}

/** Horas extra autorizadas por la jefa de taller (formulario firmado): minutos desde las 00:00. */
export interface OvertimeAuthorization {
  employeeId: string;
  date: string;
  fromMinutes: number;
  toMinutes: number;
}

export interface EmployeeProposal {
  employeeId: string;
  name: string;
  /** Hay marcaciones en alguno de los dos archivos. */
  hasPunches: boolean;
  lateMinutes: number;
  absentWeekdays: number;
  absentSaturdays: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  /** Días de la quincena antes de su ingreso (o después de su salida): no se pagan. */
  notEmployedDays: number;
  review: { date: string; flags: DayFlag[] }[];
  /** Días a los que les falta la entrada o la salida, sin revisar: mientras haya, no pasa a la Quincena. */
  blockingDays: number;
  /** Día por día de la quincena (para ver el detalle). */
  days: DayResult[];
  /** Sus marcaciones de la quincena, de las dos fuentes. */
  punches: RawPunch[];
  /** Lo que se sugiere escribir en Registro. */
  suggested: {
    /** Horas decimales (3.38 = 3 h 23 min): llegadas tarde y salidas temprano, minuto a minuto. */
    horasDescontadas: number;
    /** Días sin ninguna marcación, sábados incluidos (un sábado vale un día completo,
     *  para que no empiecen a faltar los sábados por valer menos). */
    diasDescontados: number;
    /** Horas extra autorizadas. */
    extraHours: number;
  };
}

/** Primer y último día de una quincena (`YYYY-MM-DD`). */
export function periodDateRange(year: number, month: number, half: 1 | 2): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return half === 1 ? { from: `${year}-${mm}-01`, to: `${year}-${mm}-15` } : { from: `${year}-${mm}-16`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Días de la quincena en que todavía no trabajaba (antes del ingreso) o ya no
 * (después de la salida). Como siempre en Ebony: el base de la quincena va
 * completo y estos días van a "Días descontados" (sueldo ÷ 30 cada uno; la
 * quincena vale 15 días, el 31 no cuenta aparte). Ej.: entra el 21 → 16 al 20 = 5.
 */
export function notEmployedDays(from: string, to: string, startDate?: string | null, endDate?: string | null): number {
  const day = (d: string) => Number(d.slice(8, 10));
  const first = day(from);
  const last = Math.min(day(to), first === 1 ? 15 : 30);
  let days = 0;
  if (startDate) {
    if (startDate > to) return 15;
    if (startDate > from) days += day(startDate) - first;
  }
  if (endDate) {
    if (endDate < from) return 15;
    if (endDate < to) days += Math.max(0, last - day(endDate));
  }
  return Math.min(15, days);
}

export function buildProposal(input: {
  from: string;
  to: string;
  punches: readonly RawPunch[];
  employees: readonly ProposalEmployee[];
  overtime?: readonly OvertimeAuthorization[];
  schedule?: Schedule;
  /** Vínculos nombre → empleado guardados en la app (ver `matchEmployees`). */
  links?: ReadonlyMap<string, string | null>;
  /** Días revisados a mano. */
  resolutions?: readonly (DayResolution & { employeeId: string; date: string })[];
  /** Hoy (`YYYY-MM-DD`): lo que viene no se analiza y hoy está en curso. */
  today?: string;
}): { proposals: EmployeeProposal[]; unmatched: string[] } {
  const { from, to, employees } = input;
  const inRange = input.punches.filter((p) => p.date >= from && p.date <= to);
  const { matched, unmatched } = matchEmployees(inRange.map((p) => p.name), employees, input.links);

  const byEmployee = new Map<string, RawPunch[]>();
  for (const p of inRange) {
    const e = matched.get(p.name);
    if (!e) continue;
    byEmployee.set(e.id, [...(byEmployee.get(e.id) ?? []), p]);
  }
  const overtimeBy = new Map<string, number>();
  for (const o of input.overtime ?? []) {
    if (o.date < from || o.date > to) continue;
    overtimeBy.set(o.employeeId, (overtimeBy.get(o.employeeId) ?? 0) + Math.max(0, o.toMinutes - o.fromMinutes));
  }

  const resolutionsBy = new Map<string, Map<string, DayResolution>>();
  for (const r of input.resolutions ?? []) {
    const m = resolutionsBy.get(r.employeeId) ?? new Map<string, DayResolution>();
    m.set(r.date, { arrival: r.arrival, departure: r.departure, note: r.note });
    resolutionsBy.set(r.employeeId, m);
  }

  const proposals: EmployeeProposal[] = [];
  for (const e of employees) {
    const punches = byEmployee.get(e.id) ?? [];
    const overtimeMinutes = overtimeBy.get(e.id) ?? 0;
    const outside = notEmployedDays(from, to, e.startDate, e.status === "INACTIVE" ? e.endDate : null);
    // Quien no marca en ningún archivo (administrativas, o gente que solo sale a proyectos
    // sin Jotform) no se toca: sin datos no se inventan descuentos. Salvo los días antes de
    // su ingreso (o después de su salida), que no se pagan aunque no ponche.
    if (punches.length === 0 && overtimeMinutes === 0) {
      if (outside > 0)
        proposals.push({
          employeeId: e.id,
          name: e.name,
          hasPunches: false,
          lateMinutes: 0,
          absentWeekdays: 0,
          absentSaturdays: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          notEmployedDays: outside,
          review: [],
          blockingDays: 0,
          days: [],
          punches: [],
          suggested: { horasDescontadas: 0, diasDescontados: outside, extraHours: 0 },
        });
      continue;
    }
    const a = analyzePeriod(
      from,
      to,
      punches,
      input.schedule,
      { startDate: e.startDate, endDate: e.status === "INACTIVE" ? e.endDate : null },
      { resolutions: resolutionsBy.get(e.id), today: input.today }
    );
    const lateHours = minutesToHours(a.lateMinutes + a.earlyLeaveMinutes);
    proposals.push({
      employeeId: e.id,
      name: e.name,
      hasPunches: punches.length > 0,
      lateMinutes: a.lateMinutes,
      absentWeekdays: a.absentWeekdays,
      absentSaturdays: a.absentSaturdays,
      earlyLeaveMinutes: a.earlyLeaveMinutes,
      overtimeMinutes,
      notEmployedDays: outside,
      review: a.review,
      blockingDays: a.blockingDays,
      days: a.days,
      punches,
      suggested: {
        horasDescontadas: Math.round(lateHours * 100) / 100,
        diasDescontados: (punches.length > 0 ? a.absentWeekdays + a.absentSaturdays : 0) + outside,
        extraHours: minutesToHours(overtimeMinutes),
      },
    });
  }
  return { proposals, unmatched };
}

/** Todas las fechas de una quincena (útil para armar la lista de formularios de horas extra). */
export const periodDates = (from: string, to: string) => datesBetween(from, to);
