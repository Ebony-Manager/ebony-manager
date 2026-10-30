// Ventas: Clientes y Seguimiento de cotizaciones.

export const CLIENT_KINDS = ["arquitecto", "cliente"] as const;
/** arquitecto = arquitecto/diseñador (trae el trabajo); cliente = cliente final. */
export type ClientKind = (typeof CLIENT_KINDS)[number];

export interface Client {
  id: string;
  name: string;
  kind: ClientKind;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  active: boolean;
}

export const STAGES = ["por_cotizar", "cotizando", "enviada", "aprobada", "perdida"] as const;
export type Stage = (typeof STAGES)[number];
/** Las que siguen abiertas (se trabajan). */
export const OPEN_STAGES: readonly Stage[] = ["por_cotizar", "cotizando", "enviada"];

export const LOST_REASONS = ["precio", "tiempo", "otro_proveedor", "sin_respuesta", "otro"] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** Una cotización del cotizador enlazada a la oportunidad. */
export interface LinkedQuote {
  id: string;
  number: string;
  quoteDate: string;
  status: string;
  total: number;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  title: string;
  designerId: string | null;
  clientId: string | null;
  location: string | null;
  stage: Stage;
  lostReason: LostReason | null;
  lostNote: string | null;
  receivedOn: string;
  dueOn: string | null;
  nextFollowUp: string | null;
  stageChangedAt: string;
  sentOn: string | null;
  closedOn: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** Escrito a mano (si no hay cotización en la app). */
  amount: number | null;
  projectId: string | null;
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  notes: string | null;
  createdAt: string;
  /** Del cotizador, la más reciente primero (la vigente). */
  quotes: LinkedQuote[];
}

export interface OpportunityNote {
  id: string;
  opportunityId: string;
  body: string;
  createdByName: string | null;
  createdAt: string;
}

export interface SalesPerson {
  id: string;
  name: string;
}
