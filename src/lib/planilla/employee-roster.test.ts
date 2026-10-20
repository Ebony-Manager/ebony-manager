import { describe, expect, it } from "vitest";

import type { PayrollEmployee } from "@/types/planilla";
import { buildRoster, type RosterLabels } from "./employee-roster";

const L: RosterLabels = { cedula: "Cédula", pasaporte: "Pasaporte", taller: "Taller", administrativo: "Administrativo", ahorro: "Ahorro", corriente: "Corriente", active: "Activo", inactive: "Inactivo", country: (c) => (c === "CO" ? "Colombia" : c) };
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const emp = (over: Partial<PayrollEmployee>): PayrollEmployee =>
  ({
    id: "1", name: "Jose Salcedo", position: "Ebanista", startDate: "2023-07-11", endDate: null, status: "ACTIVE", categoria: "taller",
    baseSalaryCents: 0, benefitsBaseSalaryCents: null, benefitsEnabled: true, benefitsExternalCompany: null, notes: null, liquidationNotes: null, sortOrder: 0,
    idDocument: "BA974846", idDocumentType: "pasaporte", nationality: "CO", birthDate: null, photoPath: null,
    phone: "6824-9383", email: null, address: null, emergencyContactName: "Daniela", emergencyContactPhone: "6644-1584", contractInfo: null,
    bankName: "Banco General", bankAccountType: "ahorro", bankAccountNumber: "04-21-96", bankRoutingCode: null, ...over,
  }) as PayrollEmployee;

describe("buildRoster", () => {
  it("convierte la ficha a texto: documento con su tipo, banco con tipo de cuenta, fechas formateadas", () => {
    const [r] = buildRoster([emp({})], { includeInactive: false }, fmt, L);
    expect(r).toMatchObject({
      n: 1, name: "Jose Salcedo", position: "Ebanista", type: "Taller", startDate: "11/07/2023",
      document: "Pasaporte BA974846", nationality: "Colombia", phone: "6824-9383",
      bank: "Banco General · Ahorro · 04-21-96", emergency: "Daniela · 6644-1584", status: "Activo",
    });
  });

  it("lo que falta se muestra como guion (nacimiento, banco, etc.)", () => {
    const [r] = buildRoster(
      [emp({ birthDate: null, idDocument: null, idDocumentType: null, bankName: null, bankAccountType: null, bankAccountNumber: null, phone: null, nationality: null, position: null, startDate: null })],
      { includeInactive: false }, fmt, L
    );
    expect(r).toMatchObject({ birthDate: "–", document: "–", bank: "–", phone: "–", nationality: "–", position: "–", startDate: "–" });
  });

  it("solo vigentes por defecto; con includeInactive entran todos, numerados en orden", () => {
    const list = [emp({ id: "a" }), emp({ id: "b", status: "INACTIVE", endDate: "2026-03-15", name: "Otro" }), emp({ id: "c", name: "Tercero" })];
    expect(buildRoster(list, { includeInactive: false }, fmt, L).map((r) => [r.n, r.id])).toEqual([[1, "a"], [2, "c"]]);
    const all = buildRoster(list, { includeInactive: true }, fmt, L);
    expect(all.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(all[1]).toMatchObject({ status: "Inactivo", endDate: "15/03/2026", isActive: false });
  });

  it("categoría administrativa", () => {
    expect(buildRoster([emp({ categoria: "administrativo" })], { includeInactive: false }, fmt, L)[0].type).toBe("Administrativo");
  });
});
