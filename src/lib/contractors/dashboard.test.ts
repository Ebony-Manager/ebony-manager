import { describe, expect, it } from "vitest";

import { computeContractorsDashboard, type DashboardContractor, type DashboardEntry } from "./dashboard";

const A: DashboardContractor = { id: "a", name: "Ana", contractorType: "ebanista", status: "ACTIVE" };
const B: DashboardContractor = { id: "b", name: "Beto", contractorType: "pintor", status: "ACTIVE" };
const e = (contractorId: string, entryDate: string, category: DashboardEntry["category"], amountCents: number, over: Partial<DashboardEntry> = {}): DashboardEntry => ({
  contractorId, entryDate, category,
  direction: ["trabajo", "bono", "extra"].includes(category) ? "a_favor" : "reduce",
  amountCents, projectId: null, clientText: null, mt2: null, ebonyAbsorbsMaterial: false, ...over,
});

const ENTRIES: DashboardEntry[] = [
  e("a", "2026-01-10", "trabajo", 100000, { clientText: "Saga", mt2: 10 }),
  e("a", "2026-01-25", "trabajo", 50000, { clientText: "SAGA ", mt2: 5 }),
  e("a", "2026-02-05", "trabajo", 80000, { clientText: "Truevita" }),
  e("a", "2026-01-31", "pago", 60000),
  e("a", "2026-02-15", "pago", 40000),
  e("a", "2026-03-01", "prestamo", 20000),
  e("a", "2025-12-01", "trabajo", 30000, { clientText: "Viejo" }),
  e("b", "2026-02-02", "trabajo", 70000, { projectId: "p1" }),
  e("b", "2026-02-20", "material", 10000),
  e("b", "2026-02-20", "material", 5000, { ebonyAbsorbsMaterial: true }),
  e("b", "2026-02-28", "pago", 30000),
];
const NAMES = new Map([["p1", "Proyecto Uno"]]);

describe("computeContractorsDashboard", () => {
  const d = computeContractorsDashboard([A, B], ENTRIES, NAMES, 2026);
  const a = d.contractors[0], b = d.contractors[1];

  it("facturado, pagado, préstamos y total entregado (solo del año)", () => {
    expect(a).toMatchObject({ billedCents: 230000, paidCents: 100000, loansCents: 20000, deliveredCents: 120000 });
    expect(b).toMatchObject({ billedCents: 70000, paidCents: 30000, materialCents: 10000 });
  });

  it("el saldo es de TODA la historia, no del año; el material que Ebony asume no cuenta", () => {
    // Ana: 100000+50000+80000+30000 − 60000 − 40000 − 20000 = 140000
    expect(a.balanceCents).toBe(140000);
    // Beto: 70000 − 10000 − 30000 = 30000 (el material asumido no resta)
    expect(b.balanceCents).toBe(30000);
  });

  it("proyectos: se agrupan por nombre sin importar mayúsculas ni espacios, o por proyecto enlazado", () => {
    expect(a.projects.map((p) => p.name).sort()).toEqual(["Saga", "Truevita"]);
    const saga = a.projects.find((p) => p.name === "Saga")!;
    expect(saga).toMatchObject({ billedCents: 150000, firstDate: "2026-01-10", lastDate: "2026-01-25", days: 15 });
    expect(b.projects[0]).toMatchObject({ name: "Proyecto Uno", billedCents: 70000 });
  });

  it("días por proyecto: solo cuentan los que tienen 2+ fechas distintas", () => {
    expect(a.avgDaysPerProject).toBe(15);
    expect(a.projectsMeasured).toBe(1);
    expect(b.avgDaysPerProject).toBeNull();
  });

  it("m² y costo por m²", () => {
    expect(a.mt2).toBe(15);
    expect(a.costPerMt2Cents).toBe(10000); // 150000 / 15
    expect(b.costPerMt2Cents).toBeNull();
  });

  it("serie mensual: 12 meses del año con pagado, préstamos y facturado de todos juntos", () => {
    expect(d.monthly).toHaveLength(12);
    const feb = d.monthly[1];
    expect(feb).toMatchObject({ key: "2026-02", paidCents: 70000, billedCents: 150000 });
    expect(d.monthly[2]).toMatchObject({ key: "2026-03", loansCents: 20000 });
  });

  it("totales", () => {
    expect(d.totals).toMatchObject({ contractors: 2, billedCents: 300000, paidCents: 130000, loansCents: 20000, deliveredCents: 150000, owedCents: 170000, projects: 3 });
  });

  it("período 'todo': incluye 2025 y rellena los meses sin movimientos", () => {
    const all = computeContractorsDashboard([A, B], ENTRIES, NAMES, "all");
    expect(all.monthly[0].key).toBe("2025-12");
    expect(all.monthly).toHaveLength(4); // dic-2025 → mar-2026
    expect(all.contractors[0].billedCents).toBe(260000);
  });
});
