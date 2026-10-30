import { describe, expect, it } from "vitest";

import { summarizeAttendance, type AttendanceEmployee, type AttendancePeriodRow } from "./attendance-summary";

const emp = (id: string, categoria: "taller" | "administrativo" = "taller", active = true): AttendanceEmployee => ({
  id,
  name: id,
  categoria,
  active,
  sortOrder: Number(id.replace(/\D/g, "")) || 0,
});
const row = (employeeId: string, month: number, half: 1 | 2, hours: number, days: number, cents = 0): AttendancePeriodRow => ({
  employeeId,
  month,
  half,
  hours,
  days,
  cents,
});

describe("summarizeAttendance", () => {
  const employees = [emp("e1"), emp("e2"), emp("e3", "administrativo"), emp("e4", "taller", false)];
  const rows = [
    row("e1", 10, 1, 1.5, 1, 4000),
    row("e1", 10, 2, 0.5, 0, 500),
    row("e2", 10, 1, 3, 0, 3000),
    row("e3", 10, 1, 0, 0),
    row("e4", 10, 1, 0, 0),
    row("e2", 9, 2, 0, 2, 8000),
  ];

  it("suma el mes y arma los rankings", () => {
    const s = summarizeAttendance(employees, rows, 10);
    expect(s).toMatchObject({ days: 1, hours: 5, cents: 7500 });
    expect(s.byAbsences.map((t) => t.employee.id)).toEqual(["e1"]);
    expect(s.byLateness.map((t) => [t.employee.id, t.hours])).toEqual([
      ["e2", 3],
      ["e1", 2],
    ]);
    // Sin descuentos en el período (e4 está inactivo: no sale).
    expect(s.spotless.map((e) => e.id)).toEqual(["e3"]);
  });

  it("el año junta todos los meses", () => {
    const s = summarizeAttendance(employees, rows, null);
    expect(s.days).toBe(3);
    expect(s.byAbsences.map((t) => [t.employee.id, t.days])).toEqual([
      ["e2", 2],
      ["e1", 1],
    ]);
  });

  it("quien está inactivo no sale en el resumen", () => {
    const s = summarizeAttendance(employees, [...rows, row("e4", 10, 2, 4, 3, 9000)], 10);
    expect(s).toMatchObject({ days: 1, hours: 5, cents: 7500 });
    expect(s.byAbsences.map((t) => t.employee.id)).toEqual(["e1"]);
  });

  it("filtra por categoría", () => {
    const s = summarizeAttendance(employees, rows, 10, "administrativo");
    expect(s.hours).toBe(0);
    expect(s.spotless.map((e) => e.id)).toEqual(["e3"]);
  });
});
