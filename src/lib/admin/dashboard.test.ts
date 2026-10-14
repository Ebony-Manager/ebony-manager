import { describe, expect, it } from "vitest";

import { computeAdminDashboard, type AdminContractorEntry, type AdminPlanillaRow } from "./dashboard";

const planilla: AdminPlanillaRow[] = [
  { id: "t1", name: "Taller Uno", categoria: "taller", totalsByPeriod: { "1-1": 40000, "1-2": 40000, "2-1": 50000 } },
  { id: "a1", name: "Admin Uno", categoria: "administrativo", totalsByPeriod: { "1-1": 30000, "1-2": 30000 } },
];
const entries: AdminContractorEntry[] = [
  { contractorId: "c1", entryDate: "2026-01-10", category: "pago", amountCents: 100000, projectId: null, clientText: null },
  { contractorId: "c1", entryDate: "2026-01-20", category: "trabajo", amountCents: 500, projectId: "p1", clientText: null },
  { contractorId: "c2", entryDate: "2026-01-21", category: "trabajo", amountCents: 500, projectId: null, clientText: "Nomada Golden " },
  { contractorId: "c2", entryDate: "2026-01-22", category: "trabajo", amountCents: 500, projectId: null, clientText: "nomada  golden" },
  { contractorId: "c2", entryDate: "2026-02-05", category: "pago", amountCents: 20000, projectId: null, clientText: null },
  { contractorId: "c1", entryDate: "2025-12-05", category: "pago", amountCents: 999999, projectId: null, clientText: null },
];
const base = {
  year: 2026,
  lastOccurredMonth: 2,
  planilla,
  contractors: [{ id: "c1", name: "Uno" }, { id: "c2", name: "Dos" }],
  entries,
  projectNames: new Map([["p1", "Proyecto Uno"]]),
};

describe("computeAdminDashboard", () => {
  const d = computeAdminDashboard(base);

  it("separa el mes en taller, administrativos y contratistas", () => {
    expect(d.months[0]).toMatchObject({ tallerCents: 80000, adminCents: 60000, contractorsCents: 100000, totalCents: 240000 });
    expect(d.months[1]).toMatchObject({ tallerCents: 50000, adminCents: 0, contractorsCents: 20000, totalCents: 70000 });
  });

  it("ignora movimientos de otro año", () => {
    expect(d.months[11].contractorsCents).toBe(0);
  });

  it("cuenta proyectos distintos (el mismo cliente escrito distinto es uno solo)", () => {
    expect(d.months[0].projects).toBe(2);
    expect(d.projectsByMonth[0].map((p) => p.name).sort()).toEqual(["Nomada Golden", "Proyecto Uno"].sort());
  });

  it("el acumulado solo cuenta hasta el último mes ocurrido", () => {
    expect(d.ytd.totalCents).toBe(240000 + 70000);
    const future = computeAdminDashboard({ ...base, lastOccurredMonth: 1 });
    expect(future.ytd.totalCents).toBe(240000);
    expect(future.months[1].occurred).toBe(false);
  });

  it("rankings: ordenados de mayor a menor", () => {
    expect(d.topEmployeesYear.map((x) => [x.name, x.cents])).toEqual([["Taller Uno", 130000], ["Admin Uno", 60000]]);
    expect(d.topContractorsYear.map((x) => x.name)).toEqual(["Uno", "Dos"]);
    expect(d.months[0].employeesPaid).toBe(2);
    expect(d.months[0].contractorsPaid).toBe(1);
  });
});
