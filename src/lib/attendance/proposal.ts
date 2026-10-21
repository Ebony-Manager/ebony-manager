/**
 * Propuesta de horas de una quincena: junta las marcaciones (reloj + Jotform) de
 * cada empleado, aplica las reglas de `engine.ts` y las horas extra autorizadas
 * por la jefa de taller, y devuelve lo que se le sugeriría escribir en Registro.
 * Solo propone: quien llama decide qué aplicar.
 */
import { analyzePeriod, datesBetween, minutesToHours, nightSurchargeCents } from "./engine";
import { matchEmployees, type MatchableEmployee } from "./parse";
import type { DayFlag, DayResult, RawPunch, Schedule } from "./types";

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
  nightMinutes: number;
  review: { date: string; flags: DayFlag[] }[];
  /** Día por día de la quincena (para ver el detalle). */
  days: DayResult[];
  /** Sus marcaciones de la quincena, de las dos fuentes. */
  punches: RawPunch[];
  /** Lo que se sugiere escribir en Registro. */
  suggested: {
    /** Horas decimales (3.38 = 3 h 23 min): solo las llegadas tarde, minuto a minuto. */
    horasDescontadas: number;
    /** Días sin ninguna marcación, sábados incluidos (un sábado vale un día completo,
     *  para que no empiecen a faltar los sábados por valer menos). */
    diasDescontados: number;
    /** Horas extra autorizadas. */
    extraHours: number;
    /** Recargo nocturno en centavos (solo quien lo tiene). */
    nightSurchargeCents: number;
  };
}

/** Quien tiene recargo nocturno automático (minúsculas, sin acentos). Hoy solo José Salcedo. */
export const NIGHT_SURCHARGE_NAMES = ["jose salcedo"];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Primer y último día de una quincena (`YYYY-MM-DD`). */
export function periodDateRange(year: number, month: number, half: 1 | 2): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return half === 1 ? { from: `${year}-${mm}-01`, to: `${year}-${mm}-15` } : { from: `${year}-${mm}-16`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
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

  const proposals: EmployeeProposal[] = [];
  for (const e of employees) {
    const punches = byEmployee.get(e.id) ?? [];
    const overtimeMinutes = overtimeBy.get(e.id) ?? 0;
    // Quien no marca en ningún archivo (administrativas, o gente que solo sale a proyectos
    // sin Jotform) no se toca: sin datos no se inventan descuentos.
    if (punches.length === 0 && overtimeMinutes === 0) continue;
    const a = analyzePeriod(from, to, punches, input.schedule, {
      startDate: e.startDate,
      endDate: e.status === "INACTIVE" ? e.endDate : null,
    });
    const hasNight = NIGHT_SURCHARGE_NAMES.includes(fold(e.name));
    const lateHours = minutesToHours(a.lateMinutes);
    proposals.push({
      employeeId: e.id,
      name: e.name,
      hasPunches: punches.length > 0,
      lateMinutes: a.lateMinutes,
      absentWeekdays: a.absentWeekdays,
      absentSaturdays: a.absentSaturdays,
      earlyLeaveMinutes: a.earlyLeaveMinutes,
      overtimeMinutes,
      nightMinutes: hasNight ? a.nightMinutes : 0,
      review: a.review,
      days: a.days,
      punches,
      suggested: {
        horasDescontadas: Math.round(lateHours * 100) / 100,
        diasDescontados: punches.length > 0 ? a.absentWeekdays + a.absentSaturdays : 0,
        extraHours: minutesToHours(overtimeMinutes),
        nightSurchargeCents: hasNight ? nightSurchargeCents(a.nightMinutes, e.monthlySalaryCents) : 0,
      },
    });
  }
  return { proposals, unmatched };
}

/** Todas las fechas de una quincena (útil para armar la lista de formularios de horas extra). */
export const periodDates = (from: string, to: string) => datesBetween(from, to);
