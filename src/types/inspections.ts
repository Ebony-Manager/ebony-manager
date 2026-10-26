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

/** Conteos por proyecto para la lista de Inspecciones. */
export interface InspectionProjectStats {
  visits: number;
  pending: number;
  resolved: number;
  /** YYYY-MM-DD de la última visita. */
  lastVisit: string | null;
}
