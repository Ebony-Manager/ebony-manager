import type { Quote, QuoteOwnerOptions } from "@/types/cotizador";

/**
 * De quién es una cotización ("¿Para qué es?"). Las personas salen siempre
 * de Clientes (por id); los nombres que se guardan en la cotización
 * (clientName, designerName, projectName) son solo la copia para la lista,
 * la búsqueda y lo que ve el cliente.
 */

type Person = { id: string; name: string };
type Opp = QuoteOwnerOptions["opportunities"][number];
type Project = QuoteOwnerOptions["projects"][number];
export type OwnerPatch = Pick<Quote, "opportunityId" | "projectId" | "designerId" | "designerContactId" | "clientId" | "clientName" | "designerName" | "projectName">;

const nameOf = (people: Person[], id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? "") : "");

/** Trabajo nuevo: todo sale de la oportunidad de Seguimiento. */
export function linkOpportunity(opp: Opp, people: Person[]): OwnerPatch {
  return {
    opportunityId: opp.id,
    projectId: null,
    designerId: opp.designerId,
    designerContactId: opp.designerContactId,
    clientId: opp.clientId,
    designerName: nameOf(people, opp.designerId),
    clientName: nameOf(people, opp.clientId),
    projectName: [opp.title, opp.location].filter(Boolean).join(" · "),
  };
}

/** Algo más en una obra que ya tenemos: la firma y el cliente del proyecto. */
export function linkProject(project: Project, people: Person[], contactId: string | null = null): OwnerPatch {
  return {
    opportunityId: null,
    projectId: project.id,
    designerId: project.designerId,
    designerContactId: project.designerId ? contactId : null,
    clientId: project.clientId,
    designerName: nameOf(people, project.designerId),
    clientName: nameOf(people, project.clientId),
    projectName: project.name,
  };
}

/** Solo el cliente (reparación, algo rápido): se eligen firma y/o cliente final. */
export function linkClients(
  ids: { designerId: string | null; designerContactId: string | null; clientId: string | null },
  people: Person[],
  projectName: string
): OwnerPatch {
  return {
    opportunityId: null,
    projectId: null,
    designerId: ids.designerId,
    designerContactId: ids.designerId ? ids.designerContactId : null,
    clientId: ids.clientId,
    designerName: nameOf(people, ids.designerId),
    clientName: nameOf(people, ids.clientId),
    projectName,
  };
}

/** Lo que se muestra como "para quién": el cliente final o, si no hay, la firma. */
export function quoteWho(q: Pick<Quote, "clientName" | "designerName">): string {
  return q.clientName || q.designerName;
}

/** Fecha (YYYY-MM-DD) hasta la que vale la cotización. */
export function validUntil(quoteDate: string, days: number): string {
  const d = new Date(`${quoteDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}
