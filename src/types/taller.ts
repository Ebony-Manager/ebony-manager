/** Taller · Trabajos (ver TALLER-PLAN.md). Por ahora un solo tipo: CNC. */

export type WorkOrderKind = "cnc";
export type WorkOrderStatus = "por_hacer" | "en_proceso" | "listo" | "cancelado";

export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = ["por_hacer", "en_proceso", "listo", "cancelado"];

export interface WorkOrderFile {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  kind: WorkOrderKind;
  title: string;
  /** null = trabajo interno del taller. */
  projectId: string | null;
  projectName: string | null;
  assigneeId: string | null;
  requestedBy: string | null;
  status: WorkOrderStatus;
  dueDate: string | null;
  startedAt: string | null;
  doneAt: string | null;
  notes: string | null;
  createdAt: string;
  files: WorkOrderFile[];
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
}

/** Hasta este tamaño un archivo se descarga a través de la app (límite del servidor). Los DXF pesan ~80–180 KB. */
export const WORK_ORDER_FILE_MAX = 4 * 1024 * 1024;
