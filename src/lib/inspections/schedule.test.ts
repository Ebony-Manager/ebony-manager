import { describe, expect, it } from "vitest";

import type { InspectionSchedule, ScheduleItem } from "@/types/inspections";
import { compliance, personPlan, planText, scheduleState, weekDays, weekStart } from "./schedule";

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

  it("plan de una persona y su texto para WhatsApp", () => {
    const list = [
      s({ itemId: "b", date: "2026-11-03", order: 2 }),
      s({ itemId: "a", date: "2026-11-03", order: 1, note: "llevar lija" }),
      s({ itemId: "c", date: "2026-11-02", order: 1, personId: "otro" }),
    ];
    const plan = personPlan(list, "pedro", weekDays("2026-11-02"));
    expect(plan.map((x) => x.itemId)).toEqual(["a", "b"]);
    const item = (id: string, comment: string): ScheduleItem => ({
      id, projectId: "p", projectName: "Ponticelli – PH Buenavista 4B", location: null, area: "Cocina", comment,
      kind: "pintura", responsible: "ebony", thirdParty: null, status: "pendiente", visitedOn: "2026-10-30", photos: [],
    });
    const text = planText("Plan de Pedro", plan, new Map([["a", item("a", "retocar puerta")], ["b", item("b", "masillar")]]), () => "Martes 3");
    expect(text).toBe("*Plan de Pedro*\n\n*Martes 3*\n1. Ponticelli – PH Buenavista 4B · Cocina: retocar puerta — llevar lija\n2. Ponticelli – PH Buenavista 4B · Cocina: masillar");
  });
});
