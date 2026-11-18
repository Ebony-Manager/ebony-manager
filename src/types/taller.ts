/** Taller · Trabajos (ver TALLER-PLAN.md). Tipos: corte de CNC y muestra de pintura. */

export type WorkOrderKind = "cnc" | "muestra";
export type WorkOrderStatus = "por_hacer" | "en_proceso" | "listo" | "cancelado";

export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = ["por_hacer", "en_proceso", "listo", "cancelado"];

export interface WorkOrderFile {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** Muestra a la que pertenece (fotos de referencia o del resultado); null = archivo del trabajo. */
  sampleId: string | null;
  role: "archivo" | "referencia" | "resultado";
}

export type PaintSampleKind = "sherwin_williams" | "benjamin_moore" | "chapilla" | "otro";
export const PAINT_SAMPLE_KINDS: readonly PaintSampleKind[] = ["sherwin_williams", "benjamin_moore", "chapilla", "otro"];
/** Las de paleta piden el código oficial del proveedor para quedar listas. */
export const needsOfficialCode = (k: PaintSampleKind) => k === "sherwin_williams" || k === "benjamin_moore";

export interface PaintSample {
  id: string;
  name: string;
  kind: PaintSampleKind;
  veneerTypeId: string | null;
  officialCode: string | null;
  sortOrder: number;
}

export interface VeneerType {
  id: string;
  name: string;
  active: boolean;
}

/** Un pintor (contratista) para las muestras: nombre, foto y su lugar en el turno. */
export interface TallerPainter {
  contractorId: string;
  name: string;
  photoPath: string | null;
  hasEmail: boolean;
  inTurn: boolean;
  /** 1 = le toca la próxima muestra; null = no está en el turno. */
  turnRank: number | null;
}

export interface WorkOrder {
  id: string;
  kind: WorkOrderKind;
  title: string;
  /** null = trabajo interno del taller. */
  projectId: string | null;
  projectName: string | null;
  /** Responsable de Personal (CNC). */
  assigneeId: string | null;
  /** Responsable contratista (pintor de muestras). */
  assigneeContractorId: string | null;
  requestedBy: string | null;
  status: WorkOrderStatus;
  dueDate: string | null;
  startedAt: string | null;
  doneAt: string | null;
  notes: string | null;
  createdAt: string;
  files: WorkOrderFile[];
  /** Solo muestras de pintura. */
  samples: PaintSample[];
}

/** Una persona de Personal que se puede asignar (nombre, cargo y foto; sin sueldos). */
export interface TallerPerson {
  employeeId: string;
  name: string;
  position: string | null;
  photoPath: string | null;
  /** Su usuario de la app (null si todavía no tiene acceso: no le llegan avisos). */
  userId: string | null;
}

export interface TallerProject {
  id: string;
  name: string;
  active: boolean;
}

export interface WorkOrderEvent {
  id: number;
  kind: "creado" | "estado" | "editado" | "responsable" | "archivo_agregado" | "archivo_borrado";
  actorId: string | null;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus | null;
  detail: string | null;
  createdAt: string;
}

export interface TallerData {
  orders: WorkOrder[];
  people: TallerPerson[];
  projects: TallerProject[];
  /** La persona de Personal de quien tiene la sesión (para «Asignados a mí»). */
  meEmployeeId: string | null;
  meUserId: string;
  painters: TallerPainter[];
  veneers: VeneerType[];
  /** Todas las muestras de pintura (el control de colores no se limita a lo reciente). */
  colorOrders: WorkOrder[];
}

/** Hasta este tamaño un archivo se descarga a través de la app (límite del servidor). Los DXF pesan ~80–180 KB. */
export const WORK_ORDER_FILE_MAX = 4 * 1024 * 1024;
