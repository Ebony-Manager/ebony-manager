import { describe, expect, it } from "vitest";
import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import { contractorToMember, employeeToMember, filterTeam, sortTeam } from "./team";

const employee = (over: Partial<PayrollEmployee>): PayrollEmployee =>
  ({ id: "e1", name: "Mario Loaiza", position: "Ebanista", categoria: "taller", status: "ACTIVE", phone: null, startDate: "2024-01-15", sortOrder: 3, ...over }) as PayrollEmployee;

const contractor = (over: Partial<Contractor>): Contractor => ({
  id: "c1",
  name: "Ángel Pérez",
  contractorType: "pintor",
  idDocument: null,
  phone: "6000-0000",
  contactInfo: null,
  startDate: null,
  status: "ACTIVE",
  endDate: null,
  notes: null,
  sortOrder: 0,
  ...over,
});

describe("employeeToMember / contractorToMember", () => {
  it("lleva a la ficha de su sección", () => {
    expect(employeeToMember(employee({})).href).toBe("/planilla/e1");
    expect(contractorToMember(contractor({})).href).toBe("/contratistas/c1");
  });

  it("marca inactivos y conserva grupo y puesto", () => {
    const m = employeeToMember(employee({ status: "INACTIVE", categoria: "administrativo" }));
    expect(m).toMatchObject({ kind: "employee", active: false, group: "administrativo", position: "Ebanista" });
    expect(contractorToMember(contractor({})).position).toBeNull();
  });
});

describe("sortTeam", () => {
  it("ordena por nombre sin importar acentos ni el tipo", () => {
    const team = [
      employeeToMember(employee({ id: "e1", name: "Mario Loaiza" })),
      contractorToMember(contractor({ id: "c1", name: "Ángel Pérez" })),
      employeeToMember(employee({ id: "e2", name: "Beatriz Ruiz" })),
    ];
    expect(sortTeam(team).map((m) => m.name)).toEqual(["Ángel Pérez", "Beatriz Ruiz", "Mario Loaiza"]);
  });
});

describe("filterTeam", () => {
  const team = [
    employeeToMember(employee({ id: "e1", name: "Mario Loaiza" })),
    contractorToMember(contractor({ id: "c1", name: "Ángel Pérez" })),
  ];

  it("filtra por tipo", () => {
    expect(filterTeam(team, { kind: "contractor", query: "" }).map((m) => m.id)).toEqual(["c1"]);
    expect(filterTeam(team, { kind: "all", query: "" })).toHaveLength(2);
  });

  it("busca por nombre sin acentos y en cualquier orden", () => {
    expect(filterTeam(team, { kind: "all", query: "angel" }).map((m) => m.id)).toEqual(["c1"]);
    expect(filterTeam(team, { kind: "all", query: "loaiza mario" }).map((m) => m.id)).toEqual(["e1"]);
  });
});
