import { describe, expect, it } from "vitest";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import { buildRoster, type RosterLabels } from "./staff-roster";

const L: RosterLabels = { cedula: "Cédula", pasaporte: "Pasaporte", taller: "Taller", administrativo: "Administrativo", contractor: "Contratista", ebanista: "Ebanista", pintor: "Pintor", ahorro: "Ahorro", corriente: "Corriente", active: "Activo", inactive: "Inactivo", country: (c) => (c === "CO" ? "Colombia" : c) };
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const emp = (over: Partial<PayrollEmployee>): PayrollEmployee =>
  ({
    id: "1", name: "Jose Salcedo", position: "Ebanista", startDate: "2023-07-11", endDate: null, status: "ACTIVE", categoria: "taller",
    baseSalaryCents: 0, benefitsBaseSalaryCents: null, benefitsEnabled: true, benefitsExternalCompany: null, notes: null, liquidationNotes: null, sortOrder: 0,
    idDocument: "BA974846", idDocumentType: "pasaporte", nationality: "CO", birthDate: null, photoPath: null, idDocumentPath: null,
    phone: "6824-9383", email: null, address: null, emergencyContactName: "Daniela", emergencyContactPhone: "6644-1584", contractInfo: null,
    bankName: "Banco General", bankAccountType: "ahorro", bankAccountNumber: "04-21-96", bankRoutingCode: null, ...over,
  }) as PayrollEmployee;

const con = (over: Partial<Contractor>): Contractor =>
  ({
    id: "k", name: "Wilson Castro", contractorType: "ebanista", idDocument: "BC652536", idDocumentType: "pasaporte", nationality: "CO",
    birthDate: "1975-03-19", photoPath: null, idDocumentPath: null, phone: "6132-8832", email: null, address: null, emergencyContactName: null, emergencyContactPhone: null,
    contractInfo: null, bankName: null, bankAccountType: null, bankAccountNumber: null, bankRoutingCode: null, startDate: null,
    status: "ACTIVE", endDate: null, notes: null, sortOrder: 0, ...over,
  }) as Contractor;

describe("buildRoster", () => {
  it("convierte la ficha a texto: documento con su tipo, banco con tipo de cuenta, fechas formateadas", () => {
    const [r] = buildRoster({ employees: [emp({})], contractors: [] }, { includeInactive: false, kind: "all" }, fmt, L);
    expect(r).toMatchObject({
      n: 1, name: "Jose Salcedo", position: "Ebanista", type: "Taller", startDate: "11/07/2023",
      document: "Pasaporte BA974846", nationality: "Colombia", phone: "6824-9383",
      bank: "Banco General · Ahorro · 04-21-96", emergency: "Daniela · 6644-1584", status: "Activo",
    });
  });

  it("lo que falta se muestra como guion (nacimiento, banco, etc.)", () => {
    const [r] = buildRoster({ employees: [emp({ birthDate: null, idDocument: null, idDocumentType: null, bankName: null, bankAccountType: null, bankAccountNumber: null, phone: null, nationality: null, position: null, startDate: null })], contractors: [] }, { includeInactive: false, kind: "all" }, fmt, L
    );
    expect(r).toMatchObject({ birthDate: "–", document: "–", bank: "–", phone: "–", nationality: "–", position: "–", startDate: "–" });
  });

  it("solo vigentes por defecto; con includeInactive entran todos, numerados en orden", () => {
    const list = [emp({ id: "a" }), emp({ id: "b", status: "INACTIVE", endDate: "2026-03-15", name: "Otro" }), emp({ id: "c", name: "Tercero" })];
    expect(buildRoster({ employees: list, contractors: [] }, { includeInactive: false, kind: "all" }, fmt, L).map((r) => [r.n, r.id])).toEqual([[1, "a"], [2, "c"]]);
    const all = buildRoster({ employees: list, contractors: [] }, { includeInactive: true, kind: "all" }, fmt, L);
    expect(all.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(all[1]).toMatchObject({ status: "Inactivo", endDate: "15/03/2026", isActive: false });
  });

  it("categoría administrativa", () => {
    expect(buildRoster({ employees: [emp({ categoria: "administrativo" })], contractors: [] }, { includeInactive: false, kind: "all" }, fmt, L)[0].type).toBe("Administrativo");
  });

  it("contratistas: tipo con su oficio, sin puesto; van después de los empleados", () => {
    const people = { employees: [emp({ id: "e" })], contractors: [con({}), con({ id: "p", contractorType: "pintor", name: "Pintor" })] };
    const all = buildRoster(people, { includeInactive: false, kind: "all" }, fmt, L);
    expect(all.map((r) => [r.n, r.id])).toEqual([[1, "e"], [2, "k"], [3, "p"]]);
    expect(all[1]).toMatchObject({ type: "Contratista · Ebanista", position: "–", document: "Pasaporte BC652536", birthDate: "19/03/1975" });
    expect(all[2].type).toBe("Contratista · Pintor");
  });

  it("filtra por tipo de persona", () => {
    const people = { employees: [emp({ id: "e" })], contractors: [con({}), con({ id: "x", status: "INACTIVE" })] };
    expect(buildRoster(people, { includeInactive: false, kind: "employee" }, fmt, L).map((r) => r.id)).toEqual(["e"]);
    expect(buildRoster(people, { includeInactive: false, kind: "contractor" }, fmt, L).map((r) => r.id)).toEqual(["k"]);
    expect(buildRoster(people, { includeInactive: true, kind: "contractor" }, fmt, L).map((r) => r.id)).toEqual(["k", "x"]);
  });
});
