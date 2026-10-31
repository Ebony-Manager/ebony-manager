// Inspecciones de obra: una inspección es una visita (proyecto + fecha); cada
// visita tiene detalles (área, comentario, fotos) que nacen Pendientes y la
// supervisora marca Resueltos. Ver supabase/migrations/20261026160000_inspecciones.sql.

export type InspectionItemStatus = "pendiente" | "resuelto";
/** De qué es el detalle; null = sin clasificar (los anteriores a este campo). */
export type InspectionKind = "pintura" | "carpinteria" | "otro";
export const INSPECTION_KINDS: readonly InspectionKind[] = ["pintura", "carpinteria", "otro"];
/** Quién causó el daño: Ebony o un tercero (con una línea de quién). */
export type InspectionResponsible = "ebony" | "tercero";

/** Un contratista pintor (solo id y nombre). */
export interface InspectionPainter {
  id: string;
  name: string;
  active: boolean;
}
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
  kind: InspectionKind | null;
  /** El pintor que lo arregla (el que pintó ese mueble); solo en pintura. */
  painterId: string | null;
  painterName: string | null;
  responsible: InspectionResponsible;
  /** Si es de un tercero: quién (ej. "el plomero"). */
  thirdParty: string | null;
  status: InspectionItemStatus;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
  photos: InspectionPhoto[];
  /** Su programación abierta (quién y qué día), si tiene. */
  schedule?: { personName: string; date: string } | null;
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

// ── Programación: qué detalle atiende quién y qué día ───────────────────

/** Quien puede atender un detalle: empleado o contratista (pintor / ebanista). */
export interface SchedulePerson {
  kind: "empleado" | "contratista";
  id: string;
  name: string;
  /** pintor / ebanista (contratistas) o taller / administrativo (empleados). */
  role: string;
}

/** programado = abierta; hecho = la supervisora lo dio por resuelto; reprogramado / cancelado = historia. */
export type ScheduleOutcome = "programado" | "hecho" | "reprogramado" | "cancelado";

export interface InspectionSchedule {
  id: string;
  itemId: string;
  personKind: "empleado" | "contratista";
  personId: string;
  personName: string;
  /** YYYY-MM-DD */
  date: string;
  /** Orden de ese día para esa persona (1, 2, 3…). */
  order: number;
  note: string | null;
  outcome: ScheduleOutcome;
  closedAt: string | null;
}

/** Un detalle visto desde la programación (con su obra y sus fotos de antes). */
export interface ScheduleItem {
  id: string;
  projectId: string;
  projectName: string;
  location: string | null;
  area: string | null;
  comment: string;
  kind: InspectionKind | null;
  responsible: InspectionResponsible;
  thirdParty: string | null;
  status: InspectionItemStatus;
  visitedOn: string;
  photos: InspectionPhoto[];
}

export interface ScheduleBoard {
  people: SchedulePerson[];
  items: ScheduleItem[];
  /** Las abiertas (de cualquier día) y todas las de la semana, más las de los últimos 30 días (cumplimiento). */
  schedules: InspectionSchedule[];
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
