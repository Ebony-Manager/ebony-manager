// Inspecciones de obra: una inspección es una visita (proyecto + fecha); cada
// visita tiene detalles (área, comentario, fotos) que nacen Pendientes y la
// supervisora marca Resueltos. Ver supabase/migrations/20261026160000_inspecciones.sql.

export type InspectionItemStatus = "pendiente" | "resuelto";
/** antes = el detalle; despues = cómo quedó al resolverlo. */
export type InspectionPhotoKind = "antes" | "despues";

export const INSPECTION_PHOTOS_BUCKET = "inspection-photos";

export interface InspectionPhoto {
  id: string;
  path: string;
  kind: InspectionPhotoKind;
  /** URL firmada (1 h); null si no se pudo firmar. */
  url: string | null;
}

export interface InspectionItem {
  id: string;
  inspectionId: string;
  area: string | null;
  comment: string;
  status: InspectionItemStatus;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  photos: InspectionPhoto[];
}

export interface Inspection {
  id: string;
  projectId: string;
  /** YYYY-MM-DD */
  visitedOn: string;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  items: InspectionItem[];
}

/** Lo que quien inspecciona ve de un proyecto (sin montos). */
export interface InspectionProject {
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  active: boolean;
}

/** Una obra con inspecciones, para el inicio de Inspecciones. */
export interface InspectionProjectCard {
  projectId: string;
  visits: number;
  pending: number;
  resolved: number;
  /** YYYY-MM-DD de la última visita. */
  lastVisit: string;
  /** Miniatura: la foto más nueva de algo pendiente (o, si no hay, la más nueva). */
  thumbUrl: string | null;
}

/** Una visita reciente (de cualquier obra). */
export interface RecentInspection {
  id: string;
  projectId: string;
  visitedOn: string;
  createdByName: string | null;
  notes: string | null;
  items: number;
  pending: number;
  thumbUrl: string | null;
}

export interface InspectionOverview {
  /** Obras con alguna visita: más pendientes primero, luego la visita más nueva. */
  projects: InspectionProjectCard[];
  /** Las últimas visitas, la más nueva primero. */
  recent: RecentInspection[];
}
