// Seguimiento de cotizaciones (sin Supabase ni React): monto vigente, nombre
// para mostrar, días en la etapa, alertas y números del período.

import type { Client, Opportunity } from "@/types/ventas";

/** El monto que vale: el de la cotización vigente (la más reciente) o, si no hay, el escrito a mano. */
export function opportunityAmount(o: Pick<Opportunity, "quotes" | "amount">): number | null {
  return o.quotes[0]?.total ?? o.amount;
}

/** "Ada Hidrogo · Juan Pérez": arquitecto y cliente final (los que haya). */
export function opportunityPeople(o: Pick<Opportunity, "designerId" | "clientId">, clients: Map<string, Client>): string {
  return [o.designerId, o.clientId]
    .map((id) => (id ? clients.get(id)?.name : null))
    .filter(Boolean)
    .join(" · ");
}

/** El nombre de la tarjeta: el proyecto/obra, o si no hay, quiénes son. */
export function opportunityTitle(o: Pick<Opportunity, "title" | "designerId" | "clientId">, clients: Map<string, Client>): string {
  return o.title.trim() || opportunityPeople(o, clients) || "—";
}

/** Días desde una fecha ISO (o timestamp) hasta hoy, en Panamá. */
export function daysSince(iso: string, today: string): number {
  const d = iso.slice(0, 10);
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000));
}

/** Lo que pide atención: entrega vencida (sin enviar) o enviada sin respuesta hace más de 7 días. */
export function opportunityAlert(o: Pick<Opportunity, "stage" | "dueOn" | "stageChangedAt" | "nextFollowUp">, today: string): "vencida" | "seguimiento" | null {
  if ((o.stage === "por_cotizar" || o.stage === "cotizando") && o.dueOn && o.dueOn < today) return "vencida";
  if (o.stage === "enviada") {
    if (o.nextFollowUp) return o.nextFollowUp <= today ? "seguimiento" : null;
    if (daysSince(o.stageChangedAt, today) > 7) return "seguimiento";
  }
  return null;
}

export interface SalesStats {
  received: number;
  sent: number;
  approved: number;
  lost: number;
  quotedAmount: number;
  approvedAmount: number;
  /** Aprobadas ÷ (aprobadas + perdidas) cerradas en el período; null sin cierres. */
  closeRate: number | null;
}

/** Números de un período [from, to] (fechas ISO): recibidas, enviadas, aprobadas, perdidas y montos. */
export function salesStats(opps: readonly Opportunity[], from: string, to: string): SalesStats {
  const inRange = (d: string | null) => !!d && d >= from && d <= to;
  const sent = opps.filter((o) => inRange(o.sentOn));
  const approved = opps.filter((o) => o.stage === "aprobada" && inRange(o.closedOn));
  const lost = opps.filter((o) => o.stage === "perdida" && inRange(o.closedOn));
  const sum = (list: Opportunity[]) => list.reduce((s, o) => s + (opportunityAmount(o) ?? 0), 0);
  return {
    received: opps.filter((o) => inRange(o.receivedOn)).length,
    sent: sent.length,
    approved: approved.length,
    lost: lost.length,
    quotedAmount: sum(sent),
    approvedAmount: sum(approved),
    closeRate: approved.length + lost.length > 0 ? approved.length / (approved.length + lost.length) : null,
  };
}

/** Por etapa, lo que pide atención primero y luego lo más viejo en la etapa. */
export function sortForBoard(list: readonly Opportunity[], today: string): Opportunity[] {
  const rank = (o: Opportunity) => (opportunityAlert(o, today) ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.stageChangedAt.localeCompare(b.stageChangedAt));
}

/** Aprobadas y perdidas: solo las cerradas en los últimos `days` días (el tablero no se llena de historia). */
export function visibleOnBoard(o: Pick<Opportunity, "stage" | "closedOn">, today: string, days = 60): boolean {
  if (o.stage !== "aprobada" && o.stage !== "perdida") return true;
  return !!o.closedOn && daysSince(o.closedOn, today) <= days;
}

export interface ClientStats {
  opportunities: Opportunity[];
  /** Suma de lo cotizado (enviadas o cerradas). */
  quoted: number;
  approved: number;
  closeRate: number | null;
  lastOn: string | null;
}

/** Lo que un cliente (como arquitecto o como cliente final) ha cotizado y aprobado. */
export function clientStats(clientId: string, opps: readonly Opportunity[]): ClientStats {
  const mine = opps.filter((o) => o.designerId === clientId || o.clientId === clientId);
  const quoted = mine.filter((o) => o.sentOn || o.stage === "aprobada" || o.stage === "perdida");
  const won = mine.filter((o) => o.stage === "aprobada");
  const lost = mine.filter((o) => o.stage === "perdida");
  const sum = (list: Opportunity[]) => list.reduce((s, o) => s + (opportunityAmount(o) ?? 0), 0);
  return {
    opportunities: [...mine].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn)),
    quoted: sum(quoted),
    approved: sum(won),
    closeRate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
    lastOn: mine.reduce<string | null>((m, o) => (!m || o.receivedOn > m ? o.receivedOn : m), null),
  };
}
