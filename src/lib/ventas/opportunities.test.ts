import { describe, expect, it } from "vitest";

import type { Client, Opportunity } from "@/types/ventas";
import { clientStats, defaultProjectName, opportunitySubtitle, projectLabel, suggestedProjectName, whoOf, opportunityAlert, opportunityContact, opportunityAmount, opportunityPeople, opportunityTitle, salesStats, visibleOnBoard } from "./opportunities";

const opp = (p: Partial<Opportunity>): Opportunity => ({
  id: "o", title: "", designerId: null, designerContactId: null, clientId: null, location: null, stage: "por_cotizar", lostReason: null, lostNote: null,
  receivedOn: "2026-10-01", dueOn: null, nextFollowUp: null, stageChangedAt: "2026-10-01T12:00:00Z", sentOn: null, closedOn: null,
  ownerId: null, ownerName: null, amount: null, projectId: null, driveFolderId: null, driveFolderUrl: null, notes: null,
  createdAt: "2026-10-01T12:00:00Z", quotes: [], ...p,
});
const client = (id: string, name: string, kind: Client["kind"]): Client =>
  ({ id, name, kind, phone: null, whatsapp: null, email: null, company: null, notes: null, active: true, contacts: [] });

describe("oportunidades", () => {
  it("monto: el de la cotización vigente o el escrito a mano", () => {
    expect(opportunityAmount(opp({ amount: 500 }))).toBe(500);
    expect(opportunityAmount(opp({ amount: 500, quotes: [{ id: "q", number: "", quoteDate: "", status: "ENVIADA", total: 1200, updatedAt: "" }] }))).toBe(1200);
    expect(opportunityAmount(opp({}))).toBeNull();
  });

  it("monto: con aprobadas, la suma de las aprobadas (pueden ser varias)", () => {
    const q = (id: string, status: string, total: number) => ({ id, number: id, quoteDate: "", status, total, updatedAt: "" });
    expect(opportunityAmount(opp({ quotes: [q("v2", "RECHAZADA", 900), q("cocina", "APROBADA", 1200), q("closet", "APROBADA", 800)] }))).toBe(2000);
  });

  it("nombre: el proyecto o, si no hay, arquitecto · cliente", () => {
    const m = new Map([["a", client("a", "Ada Hidrogo", "arquitecto")], ["c", client("c", "Juan Pérez", "cliente")]]);
    expect(opportunityTitle(opp({ title: "Peninsula 25B", designerId: "a" }), m)).toBe("Peninsula 25B");
    expect(opportunityTitle(opp({ designerId: "a", clientId: "c" }), m)).toBe("Ada Hidrogo · Juan Pérez");
    const firm = { ...client("f", "Estudio Norte", "arquitecto"), contacts: [{ id: "k", name: "Laura Gómez", role: null, phone: null, email: null }] };
    expect(opportunityPeople(opp({ designerId: "f", designerContactId: "k" }), new Map([["f", firm]]))).toBe("Estudio Norte (Laura Gómez)");
  });

  it("alertas: entrega vencida y enviada sin respuesta", () => {
    expect(opportunityAlert(opp({ dueOn: "2026-10-10" }), "2026-10-11")).toBe("vencida");
    expect(opportunityAlert(opp({ dueOn: "2026-10-10" }), "2026-10-10")).toBeNull();
    expect(opportunityAlert(opp({ stage: "enviada", stageChangedAt: "2026-10-01T12:00:00Z" }), "2026-10-09")).toBe("seguimiento");
    expect(opportunityAlert(opp({ stage: "enviada", stageChangedAt: "2026-10-01T12:00:00Z", nextFollowUp: "2026-10-20" }), "2026-10-09")).toBeNull();
  });

  it("números del período y tasa de cierre", () => {
    const list = [
      opp({ receivedOn: "2026-10-02", sentOn: "2026-10-05", stage: "aprobada", closedOn: "2026-10-20", amount: 1000 }),
      opp({ receivedOn: "2026-10-03", sentOn: "2026-10-06", stage: "perdida", closedOn: "2026-10-21", amount: 400, lostReason: "precio" }),
      opp({ receivedOn: "2026-09-03" }),
    ];
    const s = salesStats(list, "2026-10-01", "2026-10-31");
    expect(s).toMatchObject({ received: 2, sent: 2, approved: 1, lost: 1, quotedAmount: 1400, approvedAmount: 1000, closeRate: 0.5 });
  });

  it("tablero: cerradas solo las recientes", () => {
    expect(visibleOnBoard({ stage: "aprobada", closedOn: "2026-06-01" }, "2026-10-30")).toBe(false);
    expect(visibleOnBoard({ stage: "perdida", closedOn: "2026-10-01" }, "2026-10-30")).toBe(true);
    expect(visibleOnBoard({ stage: "enviada", closedOn: null }, "2026-10-30")).toBe(true);
  });

  it("cliente: cotizado, aprobado y cierre, como arquitecto o como cliente", () => {
    const list = [
      opp({ id: "1", designerId: "a", stage: "aprobada", sentOn: "2026-10-01", amount: 1000, receivedOn: "2026-09-01" }),
      opp({ id: "2", clientId: "a", stage: "perdida", amount: 500, receivedOn: "2026-10-05" }),
      opp({ id: "3", designerId: "a", stage: "cotizando", amount: 300 }),
      opp({ id: "4", designerId: "b", stage: "aprobada", amount: 900 }),
    ];
    expect(clientStats("a", list)).toMatchObject({ quoted: 1500, approved: 1000, closeRate: 0.5, lastOn: "2026-10-05" });
    expect(clientStats("a", list).opportunities.map((o) => o.id)).toEqual(["2", "3", "1"]);
  });
  it("WhatsApp: la persona de la firma, luego la firma, luego el cliente final", () => {
    const firm: Client = { ...client("f", "Nómada Studio", "arquitecto"), contacts: [{ id: "c1", name: "Ana", role: null, phone: "6000-1111", email: null }, { id: "c2", name: "Luis", role: null, phone: null, email: null }] };
    const end: Client = { ...client("e", "Lior Pesso", "cliente"), whatsapp: "6222-3333" };
    const map = new Map([firm, end].map((c) => [c.id, c]));
    expect(opportunityContact(opp({ designerId: "f", designerContactId: "c1", clientId: "e" }), map)).toEqual({ name: "Ana", phone: "6000-1111" });
    expect(opportunityContact(opp({ designerId: "f", designerContactId: "c2", clientId: "e" }), map)).toEqual({ name: "Lior Pesso", phone: "6222-3333" });
    expect(opportunityContact(opp({ designerId: "f" }), map)).toEqual({ name: "Ana", phone: "6000-1111" });
    expect(opportunityContact(opp({}), map)).toBeNull();
  });
});

describe("Nombre del proyecto: arquitecto o cliente – ubicación", () => {
  const firm = client("f1", "Dlineare", "arquitecto");
  const person = client("c1", "Ben Avi", "cliente");
  const map = new Map([[firm.id, firm], [person.id, person]]);

  it("se arma con quién y dónde, con lo que haya", () => {
    expect(suggestedProjectName("Dlineare", "Ph Serena")).toBe("Dlineare – Ph Serena");
    expect(suggestedProjectName("Dlineare", "")).toBe("Dlineare");
    expect(suggestedProjectName("", "Ph Serena")).toBe("Ph Serena");
    expect(suggestedProjectName(null, null)).toBe("");
  });

  it("da nombre la firma; si no hay firma, el cliente", () => {
    const nameOf = (id: string) => map.get(id)?.name;
    expect(whoOf("f1", "c1", nameOf)).toBe("Dlineare");
    expect(whoOf(null, "c1", nameOf)).toBe("Ben Avi");
    expect(whoOf(null, null, nameOf)).toBe("");
  });

  it("al aprobar propone el nombre de la oportunidad; si no tiene, lo arma", () => {
    expect(defaultProjectName(opp({ title: "Ph Altair", designerId: "f1" }), map)).toBe("Ph Altair");
    expect(defaultProjectName(opp({ designerId: "f1", location: "Ph Serena" }), map)).toBe("Dlineare – Ph Serena");
    expect(defaultProjectName(opp({ clientId: "c1", location: "Ph Landmark piso 22" }), map)).toBe("Ben Avi – Ph Landmark piso 22");
  });

  it("el encabezado de la cotización no repite la ubicación", () => {
    expect(projectLabel("Ph Altair", "Santa Maria")).toBe("Ph Altair · Santa Maria");
    expect(projectLabel("Dlineare – Ph Serena", "Ph Serena")).toBe("Dlineare – Ph Serena");
    expect(projectLabel("", "Santa Maria")).toBe("Santa Maria");
    expect(projectLabel("Casa 76", "")).toBe("Casa 76");
  });
});

describe("Línea de abajo del nombre", () => {
  const firm = { ...client("f1", "Estudio Espiral", "arquitecto"), contacts: [{ id: "k1", name: "Laura", role: null, phone: null, email: null }] } as Client;
  const person = client("c1", "Fernando Tussie", "cliente");
  const map = new Map([[firm.id, firm], [person.id, person]]);

  it("no repite la firma si el nombre ya la trae", () => {
    expect(opportunitySubtitle(opp({ title: "Estudio Espiral – Casa Chang", designerId: "f1" }), map)).toBe("");
    expect(opportunitySubtitle(opp({ title: "Estudio Espiral – Casa Chang", designerId: "f1", designerContactId: "k1" }), map)).toBe("Laura");
  });

  it("sin la firma en el nombre, la muestra (y al cliente final si no está)", () => {
    expect(opportunitySubtitle(opp({ title: "Casa Chang", designerId: "f1", clientId: "c1" }), map)).toBe("Estudio Espiral · Fernando Tussie");
    expect(opportunitySubtitle(opp({ title: "", designerId: "f1" }), map)).toBe("");
  });
});
