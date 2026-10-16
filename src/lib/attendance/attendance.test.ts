import { describe, expect, it } from "vitest";

import { analyzeDay, analyzePeriod, minutesToHours, nightSurchargeCents, weekdayOf } from "./engine";
import { matchEmployees, parseClockReport, parseJotformPunches } from "./parse";
import type { RawPunch } from "./types";

const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const punch = (date: string, time: string, source: "reloj" | "jotform" = "reloj"): RawPunch => ({
  name: "X",
  date,
  minutes: t(time),
  kind: "unknown",
  source,
});

describe("analyzeDay", () => {
  // 2026-10-06 es martes, 2026-10-03 sábado, 2026-10-04 domingo.
  it("llegar a las 7:30 en punto no se descuenta; después sí, minuto a minuto", () => {
    expect(analyzeDay("2026-10-06", [punch("2026-10-06", "07:30"), punch("2026-10-06", "17:05")]).lateMinutes).toBe(0);
    expect(analyzeDay("2026-10-06", [punch("2026-10-06", "07:47"), punch("2026-10-06", "17:05")]).lateMinutes).toBe(17);
  });

  it("el sábado la entrada es a las 8:00", () => {
    const d = analyzeDay("2026-10-03", [punch("2026-10-03", "08:13"), punch("2026-10-03", "13:34")]);
    expect(d.lateMinutes).toBe(13);
    expect(d.earlyLeaveMinutes).toBe(0);
  });

  it("sin salida: se asume la hora normal y el día queda en revisión", () => {
    const d = analyzeDay("2026-10-06", [punch("2026-10-06", "07:38")]);
    expect(d.flags).toContain("missing_out");
    expect(d.lateMinutes).toBe(8);
    expect(d.departure).toBeNull();
    expect(d.earlyLeaveMinutes).toBe(0);
  });

  it("una sola marcación de tarde es la salida: falta la entrada, no se descuenta tardanza", () => {
    const d = analyzeDay("2026-10-06", [punch("2026-10-06", "17:15")]);
    expect(d.flags).toEqual(expect.arrayContaining(["missing_in", "unclear"]));
    expect(d.lateMinutes).toBe(0);
  });

  it("si todas las marcaciones son de tarde no se sabe cuándo llegó: no hay tardanza", () => {
    const d = analyzeDay("2026-09-24", [punch("2026-09-24", "17:05"), punch("2026-09-24", "17:05"), punch("2026-09-24", "20:02")]);
    expect(d.lateMinutes).toBe(0);
    expect(d.arrival).toBeNull();
    expect(d.departure).toBe(t("20:02"));
    expect(d.flags).toContain("missing_in");
  });

  it("dos marcaciones casi iguales (08:13 y 08:13) no son un turno", () => {
    const d = analyzeDay("2026-10-03", [punch("2026-10-03", "08:13"), punch("2026-10-03", "08:13")]);
    expect(d.flags).toContain("missing_out");
    expect(d.flags).toContain("unclear");
  });

  it("día laborable sin marcaciones = ausente; domingo sin marcaciones no cuenta", () => {
    expect(analyzeDay("2026-10-06", []).flags).toEqual(["absent"]);
    expect(analyzeDay("2026-10-04", []).flags).toEqual([]);
    expect(analyzeDay("2026-10-04", [punch("2026-10-04", "09:00"), punch("2026-10-04", "15:00")]).flags).toContain("sunday_punch");
  });

  it("minutos después de las 6 pm (recargo nocturno)", () => {
    const d = analyzeDay("2026-10-05", [punch("2026-10-05", "08:22"), punch("2026-10-05", "20:06")]);
    expect(d.nightMinutes).toBe(126);
  });
});

describe("analyzePeriod", () => {
  it("junta reloj y Jotform: entra en el taller, sale desde el proyecto", () => {
    const punches = [punch("2026-10-06", "07:40", "reloj"), punch("2026-10-06", "17:02", "jotform")];
    const r = analyzePeriod("2026-10-05", "2026-10-06", punches);
    expect(r.days.find((d) => d.date === "2026-10-06")).toMatchObject({ arrival: t("07:40"), departure: t("17:02"), lateMinutes: 10 });
    expect(r.absentWeekdays).toBe(1); // el lunes 5 no tiene nada
    expect(r.review.map((x) => x.date)).toEqual(["2026-10-05"]);
  });
  it("antes del ingreso o después de la salida no hay ausencias", () => {
    const r = analyzePeriod("2026-10-05", "2026-10-09", [punch("2026-10-08", "07:35")], undefined, {
      startDate: "2026-10-08",
    });
    expect(r.days.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-09"]);
    expect(r.absentWeekdays).toBe(1); // solo el 9 (no marcó); el 5, 6 y 7 son antes de entrar
  });
  it("conversiones", () => {
    expect(minutesToHours(17)).toBe(0.28);
    expect(weekdayOf("2026-10-03")).toBe(6);
    // El caso explicado por Ebony: 9.18 h de recargo × 1.5 × ($950 / 240 por hora = 3.96) ≈ 54.5
    expect(nightSurchargeCents(Math.round(9.18 * 60), 95_000)).toBeGreaterThan(5_450);
    expect(nightSurchargeCents(Math.round(9.18 * 60), 95_000)).toBeLessThan(5_460);
  });
});

describe("parseClockReport", () => {
  const rows = [
    ["", "", "", "", "Timecard Report", ""],
    ["Pay Period", "", "", "20261001-20261015", ""],
    ["Employee", "", "", "Jose Salcedo (9)", ""],
    ["Date", "", "IN", "OUT", "Work Time", " Daily Total", " Note", ""],
    ["THU", "20261001", "11:37", "17:10", "05:32", "05:32", ""],
    ["FRI", "20261009", "08:50", "", "", "", "Missing OUT"],
    ["SAT", "20261003", "08:13", "08:13", "00:00", ""],
    ["", "", "13:55", "", "", "00:00", "Missing OUT"],
    ["SUN", "20261004", ""],
  ];
  it("lee entradas, salidas y filas de continuación", () => {
    const p = parseClockReport(rows);
    expect(p.map((x) => [x.date, x.minutes, x.kind])).toEqual([
      ["2026-10-01", t("11:37"), "in"],
      ["2026-10-01", t("17:10"), "out"],
      ["2026-10-09", t("08:50"), "in"],
      ["2026-10-03", t("08:13"), "in"],
      ["2026-10-03", t("08:13"), "out"],
      ["2026-10-03", t("13:55"), "in"],
    ]);
    expect(p[0].name).toBe("Jose Salcedo");
  });
});

describe("parseJotformPunches", () => {
  const rows = [
    ["ID", "Entrada o Salida?", "Fecha", "Hora", "Foto", "Detected Location", "Temp Nombre"],
    ["Eeg15", "SALIDA", "10/14/2026", "17:09", "", "", "Edgardo Guerra"],
    ["EER21", "ENTRADA", "10/13/2026", "07:00", "", "", "undefined"],
    ["Eer21", "SALIDA", "10/13/2026", "17:00", "", "", "Eliecer Rodriguez"],
  ];
  it("completa el nombre faltante por el código, sin importar mayúsculas", () => {
    const p = parseJotformPunches(rows);
    expect(p).toHaveLength(3);
    expect(p[1].name).toBe("Eliecer Rodriguez");
    expect(p[0]).toMatchObject({ date: "2026-10-14", minutes: t("17:09"), kind: "out", source: "jotform" });
  });
});

describe("matchEmployees", () => {
  const emps = [
    { id: "1", name: "Hector Berrio Benedetti" },
    { id: "2", name: "Nabil Massiel Soriano" },
    { id: "3", name: "Mario Loaiza" },
    { id: "4", name: "Jhon Pena" },
    { id: "5", name: "Sebastian Canto" },
  ];
  it("los alias confirmados por Ebony unen los dos archivos", () => {
    const r = matchEmployees(["Jhon Jader", "Alexis Canto"], emps);
    expect(r.matched.get("Jhon Jader")?.id).toBe("4");
    expect(r.matched.get("Alexis Canto")?.id).toBe("5");
  });
  it("usa alias, nombre igual y nombre contenido; lo dudoso queda sin resolver", () => {
    const r = matchEmployees(["Hector Berrio", "Nabil Soriano", "Mario Loaiza", "Jose Padilla"], emps);
    expect(r.matched.get("Hector Berrio")?.id).toBe("1");
    expect(r.matched.get("Nabil Soriano")?.id).toBe("2");
    expect(r.matched.get("Mario Loaiza")?.id).toBe("3");
    expect(r.unmatched).toEqual(["Jose Padilla"]);
  });
});

import { buildProposal, periodDateRange, type ProposalEmployee } from "./proposal";

describe("buildProposal", () => {
  const emp = (id: string, name: string, extra: Partial<ProposalEmployee> = {}): ProposalEmployee => ({
    id,
    name,
    status: "ACTIVE",
    categoria: "taller",
    startDate: "2020-01-01",
    endDate: null,
    monthlySalaryCents: 95_000,
    ...extra,
  });
  const p = (name: string, date: string, time: string, source: "reloj" | "jotform" = "reloj"): RawPunch => ({
    name,
    date,
    minutes: t(time),
    kind: "unknown",
    source,
  });

  it("rangos de quincena", () => {
    expect(periodDateRange(2026, 10, 1)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(periodDateRange(2026, 2, 2)).toEqual({ from: "2026-02-16", to: "2026-02-28" });
  });

  it("propone horas tarde, días sin marcar y extras autorizadas; ignora lo fuera de la quincena", () => {
    const { proposals } = buildProposal({
      from: "2026-10-05",
      to: "2026-10-07",
      employees: [emp("1", "Nabil Soriano")],
      punches: [
        p("Nabil Soriano", "2026-10-05", "07:50"),
        p("Nabil Soriano", "2026-10-05", "18:14"),
        p("Nabil Soriano", "2026-10-06", "07:30"),
        p("Nabil Soriano", "2026-10-06", "17:47"),
        p("Nabil Soriano", "2026-10-01", "09:00"),
      ],
      overtime: [{ employeeId: "1", date: "2026-10-05", fromMinutes: t("17:00"), toMinutes: t("18:14") }],
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].lateMinutes).toBe(20);
    expect(proposals[0].suggested).toMatchObject({ horasDescontadas: 0.33, diasDescontados: 1, extraHours: 1.23, nightSurchargeCents: 0 });
  });

  it("sin marcaciones ni extras no se propone nada", () => {
    const { proposals } = buildProposal({ from: "2026-10-05", to: "2026-10-07", employees: [emp("1", "Karina Cardona")], punches: [] });
    expect(proposals).toEqual([]);
  });

  it("recargo nocturno solo para quien lo tiene", () => {
    const punches = [p("Jose Salcedo", "2026-10-05", "08:00"), p("Jose Salcedo", "2026-10-05", "20:06")];
    const { proposals } = buildProposal({
      from: "2026-10-05",
      to: "2026-10-05",
      employees: [emp("1", "Jose Salcedo"), emp("2", "Otro Empleado")],
      punches: [...punches, p("Otro Empleado", "2026-10-05", "08:00"), p("Otro Empleado", "2026-10-05", "20:06")],
    });
    const jose = proposals.find((x) => x.employeeId === "1")!;
    const otro = proposals.find((x) => x.employeeId === "2")!;
    expect(jose.nightMinutes).toBe(126);
    expect(jose.suggested.nightSurchargeCents).toBeGreaterThan(0);
    expect(otro.suggested.nightSurchargeCents).toBe(0);
  });
});
