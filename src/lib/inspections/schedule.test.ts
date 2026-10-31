import { describe, expect, it } from "vitest";

import type { InspectionSchedule, ScheduleItem } from "@/types/inspections";
import { areaKey, blockState, compliance, dayBlocks, groupByArea, planSchedules, planText, scheduleState, weekDays, weekStart } from "./schedule";

const s = (p: Partial<InspectionSchedule>): InspectionSchedule => ({
  id: Math.random().toString(36).slice(2), itemId: "i1", personKind: "contratista", personId: "pedro", personName: "Pedro",
  date: "2026-11-03", order: 1, note: null, outcome: "programado", closedAt: null, ...p,
});

describe("programación", () => {
  it("semana de lunes a sábado", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // domingo → el lunes anterior
    expect(weekDays("2026-11-02")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
  });

  it("estado: hecho, vencido o programado", () => {
    expect(scheduleState(s({ outcome: "hecho", date: "2026-11-01" }), "2026-11-05")).toBe("hecho");
    expect(scheduleState(s({ date: "2026-11-04" }), "2026-11-05")).toBe("vencido");
    expect(scheduleState(s({ date: "2026-11-05" }), "2026-11-05")).toBe("programado");
  });

  it("cumplimiento: a tiempo, tarde y no hecho; lo de hoy pendiente no cuenta", () => {
    const list = [
      s({ outcome: "hecho", date: "2026-11-02", closedAt: "2026-11-02T20:00:00Z" }),
      s({ outcome: "hecho", date: "2026-11-02", closedAt: "2026-11-04T10:00:00Z" }),
      s({ outcome: "reprogramado", date: "2026-11-03" }),
      s({ outcome: "programado", date: "2026-11-04" }),
      s({ outcome: "programado", date: "2026-11-05" }),
      s({ outcome: "cancelado", date: "2026-11-03" }),
    ];
    const [p] = compliance(list, "2026-10-06", "2026-11-05");
    expect(p).toMatchObject({ total: 4, onTime: 1, late: 1, missed: 2, rate: 0.25 });
  });

  it("el cumplimiento no cuenta lo que no tenía a nadie asignado", () => {
    const list = [s({ outcome: "reprogramado", date: "2026-11-03", personId: null, personName: null, personKind: null })];
    expect(compliance(list, "2026-10-06", "2026-11-05")).toEqual([]);
  });

  const item = (id: string, area: string | null, comment: string, p: Partial<ScheduleItem> = {}): ScheduleItem => ({
    id, projectId: "p", projectName: "Nómada – Golden Palace", location: null, area, comment,
    kind: "pintura", responsible: "ebony", thirdParty: null, status: "pendiente", visitedOn: "2026-10-30",
    createdAt: `2026-10-30T10:00:0${id.length}Z`, photos: [], ...p,
  });

  it("áreas: mismo nombre con mayúsculas, acentos o espacios distintos es la misma área", () => {
    expect(areaKey(" Cocína  principal ")).toBe("cocina principal");
    expect(areaKey(null)).toBe("");
    const groups = groupByArea([
      item("a", "Cocina", "uno", { createdAt: "2026-10-30T10:00:02Z" }),
      item("b", "cocina ", "dos", { createdAt: "2026-10-30T10:00:01Z" }),
      item("c", null, "tres"),
      item("d", "Baño", "cuatro", { visitedOn: "2026-10-20" }),
    ]);
    expect(groups.map((g) => [g.area, g.items.map((i) => i.id)])).toEqual([
      ["Baño", ["d"]],
      ["cocina", ["b", "a"]],
      [null, ["c"]],
    ]);
  });

  it("bloques del día por obra · área, en el orden del día", () => {
    const items = new Map([
      ["a", item("a", "Cocina", "uno")],
      ["b", item("b", "Baño", "dos")],
      ["c", item("c", "cocina", "tres")],
    ]);
    const blocks = dayBlocks([s({ itemId: "c", order: 3 }), s({ itemId: "b", order: 2 }), s({ itemId: "a", order: 1 })], items);
    expect(blocks.map((b) => [b.area, b.schedules.map((x) => x.itemId)])).toEqual([
      ["Cocina", ["a", "c"]],
      ["Baño", ["b"]],
    ]);
    expect(blockState([s({ outcome: "hecho" }), s({ date: "2026-11-01" })], "2026-11-05")).toBe("vencido");
    expect(blockState([s({ outcome: "hecho" })], "2026-11-05")).toBe("hecho");
  });

  it("plan de una obra y su texto para WhatsApp", () => {
    const items = new Map([
      ["a", item("a", "Cocina", "retocar puerta")],
      ["b", item("b", "Cocina", "masillar")],
      ["c", item("c", "Baño", "sellar", { projectId: "otra" })],
    ]);
    const list = [
      s({ itemId: "b", date: "2026-11-03", order: 2, personId: null, personName: null }),
      s({ itemId: "a", date: "2026-11-03", order: 1, note: "llevar lija" }),
      s({ itemId: "c", date: "2026-11-02", order: 1 }),
    ];
    const plan = planSchedules(list, items, { projectId: "p" }, weekDays("2026-11-02"));
    expect(plan.map((x) => x.itemId)).toEqual(["a", "b"]);
    expect(planSchedules(list, items, { personId: "pedro" }, weekDays("2026-11-02")).map((x) => x.itemId)).toEqual(["c", "a"]);
    const text = planText("Plan · Golden Palace", plan, items, () => "Martes 3", { noArea: "Sin área" });
    expect(text).toBe("*Plan · Golden Palace*\n\n*Martes 3*\n▸ Cocina — Pedro\n  _llevar lija_\n1. retocar puerta\n2. masillar");
  });
});
