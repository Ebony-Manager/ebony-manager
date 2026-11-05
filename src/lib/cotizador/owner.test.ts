import { describe, expect, it } from "vitest";

import { linkClients, linkOpportunity, linkProject, quoteWho, validUntil } from "./owner";

const people = [
  { id: "f1", name: "NDesign" },
  { id: "c1", name: "Teo Zebede" },
];

describe("dueño de la cotización", () => {
  it("una oportunidad trae firma, contacto, cliente y nombre de la obra", () => {
    const p = linkOpportunity({ id: "o1", title: "Royal Palace", location: "Costa del Este", stage: "cotizando", designerId: "f1", designerContactId: "k1", clientId: "c1" }, people);
    expect(p).toEqual({
      opportunityId: "o1",
      projectId: null,
      designerId: "f1",
      designerContactId: "k1",
      clientId: "c1",
      designerName: "NDesign",
      clientName: "Teo Zebede",
      projectName: "Royal Palace · Costa del Este",
    });
  });

  it("un proyecto deja la oportunidad vacía", () => {
    const p = linkProject({ id: "p1", name: "Casa 1B", status: "ACTIVE", designerId: "f1", clientId: null }, people);
    expect(p).toMatchObject({ opportunityId: null, projectId: "p1", designerName: "NDesign", clientName: "", projectName: "Casa 1B" });
  });

  it("solo cliente no guarda contacto sin firma", () => {
    const p = linkClients({ designerId: null, designerContactId: "k1", clientId: "c1" }, people, "Reparación");
    expect(p).toMatchObject({ opportunityId: null, projectId: null, designerContactId: null, clientName: "Teo Zebede", projectName: "Reparación" });
  });

  it("muestra el cliente final o, si no hay, la firma", () => {
    expect(quoteWho({ clientName: "", designerName: "NDesign" })).toBe("NDesign");
    expect(quoteWho({ clientName: "Teo", designerName: "NDesign" })).toBe("Teo");
  });

  it("calcula hasta cuándo vale", () => {
    expect(validUntil("2026-11-05", 30)).toBe("2026-12-05");
    expect(validUntil("2026-12-20", 30)).toBe("2027-01-19");
  });
});
