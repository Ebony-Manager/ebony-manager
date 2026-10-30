import { describe, expect, it } from "vitest";

import type { Client, Opportunity } from "@/types/ventas";
import { clientStats, opportunityAlert, opportunityAmount, opportunityPeople, opportunityTitle, salesStats, visibleOnBoard } from "./opportunities";

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
});
