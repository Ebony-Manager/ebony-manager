/** Una marcación suelta (de cualquiera de las dos fuentes). Fecha `YYYY-MM-DD`, hora en minutos desde las 00:00. */
export interface RawPunch {
  /** Nombre tal como viene en el archivo. */
  name: string;
  /** Código del Jotform (ej. "EAC09"), si lo hay. */
  code?: string;
  date: string;
  minutes: number;
  /** Lo que dice el archivo; no se confía en él (a veces marcan "entrada" al salir). */
  kind: "in" | "out" | "unknown";
  source: "reloj" | "jotform";
}

export interface Schedule {
  /** Lunes a viernes: entrada y salida, en minutos. */
  weekdayStart: number;
  weekdayEnd: number;
  /** Sábado. */
  saturdayStart: number;
  saturdayEnd: number;
  /** Si no hay marcación de salida se asume la hora normal de salida. */
  assumeMissingOut: boolean;
  /** A partir de esta hora (minutos) se paga recargo nocturno a quien lo tenga (ej. José Salcedo). */
  nightFrom: number;
}

export const DEFAULT_SCHEDULE: Schedule = {
  weekdayStart: 7 * 60 + 30,
  weekdayEnd: 17 * 60,
  saturdayStart: 8 * 60,
  saturdayEnd: 13 * 60 + 30,
  assumeMissingOut: true,
  nightFrom: 18 * 60,
};

export type DayFlag =
  /** No hay ninguna marcación en un día laborable. */
  | "absent"
  /** Falta la salida: se asumió la hora normal de salida. */
  | "missing_out"
  /** Falta la entrada (solo hay una marcación de tarde): se asumió a tiempo. */
  | "missing_in"
  /** Una sola marcación al mediodía o dos iguales: no se puede saber qué pasó. */
  | "unclear"
  /** Salió antes de la hora normal. */
  | "early_leave"
  /** Marcó en domingo. */
  | "sunday_punch";

export interface DayResult {
  date: string;
  /** 1 = lunes … 6 = sábado, 0 = domingo. */
  weekday: number;
  arrival: number | null;
  departure: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /** Minutos trabajados después de `nightFrom` (solo cuenta con salida real). */
  nightMinutes: number;
  flags: DayFlag[];
  sources: ("reloj" | "jotform")[];
}

export interface EmployeeAttendance {
  days: DayResult[];
  lateMinutes: number;
  absentWeekdays: number;
  absentSaturdays: number;
  earlyLeaveMinutes: number;
  nightMinutes: number;
  review: { date: string; flags: DayFlag[] }[];
}
