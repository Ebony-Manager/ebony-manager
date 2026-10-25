// Resumen de asistencia: quién falta más y quién llega tarde más, a partir
// de lo que se DESCONTÓ en cada quincena (días y horas). Es la misma regla
// para todos: sale del reloj y del Jotform ya procesados en Asistencia.
// Puro: lo usa el Resumen de Personal y la pestaña Asistencia de Pagos.

export interface AttendancePeriodRow {
  employeeId: string;
  month: number;
  half: 1 | 2;
  hours: number;
  days: number;
  cents: number;
}

export interface AttendanceEmployee {
  id: string;
  name: string;
  categoria: "taller" | "administrativo";
  active: boolean;
  sortOrder: number;
}

export interface AttendancePersonTotal {
  employee: AttendanceEmployee;
  hours: number;
  days: number;
  cents: number;
  /** Quincenas con registro en el período (para saber si estuvo). */
  periods: number;
}

export interface AttendanceSummary {
  days: number;
  hours: number;
  cents: number;
  /** Más días de falta primero (empates: más horas). */
  byAbsences: AttendancePersonTotal[];
  /** Más horas de tardanza primero (empates: más días). */
  byLateness: AttendancePersonTotal[];
  /** Con registro en el período y sin descuentos de asistencia. */
  spotless: AttendanceEmployee[];
}

/**
 * Suma por persona dentro del período (`month` null = todo el año) y arma
 * los rankings. Solo cuentan empleados con quincena registrada en el
 * período (activos o no: es lo que pasó); el filtro de categoría
 * (Taller / Administrativo) va aparte.
 */
export function summarizeAttendance(
  employees: readonly AttendanceEmployee[],
  rows: readonly AttendancePeriodRow[],
  month: number | null,
  categoria: "todos" | "taller" | "administrativo" = "todos",
): AttendanceSummary {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const totals = new Map<string, AttendancePersonTotal>();
  for (const r of rows) {
    if (month !== null && r.month !== month) continue;
    const employee = byId.get(r.employeeId);
    // Cuenta todo lo que pasó, también de quien hoy está inactivo: la quincena
    // registrada dice que estuvo (las pantallas del momento ya solo muestran activos).
    if (!employee || (categoria !== "todos" && employee.categoria !== categoria)) continue;
    const t = totals.get(r.employeeId) ?? { employee, hours: 0, days: 0, cents: 0, periods: 0 };
    t.hours += r.hours;
    t.days += r.days;
    t.cents += r.cents;
    t.periods += 1;
    totals.set(r.employeeId, t);
  }
  const list = [...totals.values()];
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    days: round(list.reduce((s, t) => s + t.days, 0)),
    hours: round(list.reduce((s, t) => s + t.hours, 0)),
    cents: list.reduce((s, t) => s + t.cents, 0),
    byAbsences: list.filter((t) => t.days > 0).sort((a, b) => b.days - a.days || b.hours - a.hours || a.employee.sortOrder - b.employee.sortOrder),
    byLateness: list.filter((t) => t.hours > 0).sort((a, b) => b.hours - a.hours || b.days - a.days || a.employee.sortOrder - b.employee.sortOrder),
    spotless: list
      .filter((t) => t.days === 0 && t.hours === 0)
      .map((t) => t.employee)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
