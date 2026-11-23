/** Diseño · ítems de cada proyecto y sus etapas (ver el documento del flujo y TALLER-PLAN.md). */

export type ItemStage = "por_medir" | "en_diseno" | "con_cliente" | "aprobado" | "en_produccion";
/** Las etapas de diseño (en_produccion la pone la orden de producción). */
export const DESIGN_STAGES: readonly ItemStage[] = ["por_medir", "en_diseno", "con_cliente", "aprobado"];
export const ITEM_STAGES: readonly ItemStage[] = [...DESIGN_STAGES, "en_produccion"];

export type ItemFileKind = "medidas" | "foto" | "presentacion" | "aprobada";

/** Días en la misma etapa a partir de los cuales el ítem se marca atrasado (Carlos, 21 nov). */
export const STAGE_LATE_DAYS = 7;

export interface ItemFile {
  id: string;
  kind: ItemFileKind;
  round: number;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  projectId: string;
  area: string;
  name: string;
  kind: string;
  sortOrder: number;
  stage: ItemStage;
  stageSince: string;
  round: number;
  areaNotReady: boolean;
  nextVisit: string | null;
  notes: string | null;
  fromQuote: boolean;
  /** La diseñadora del ítem (Personal); null = sin asignar. */
  designerId: string | null;
  files: ItemFile[];
}

/** Una diseñadora que se puede asignar (las del proyecto). */
export interface DesignerOption {
  id: string;
  name: string;
}

export interface ItemEvent {
  id: number;
  kind: "creado" | "etapa" | "archivo" | "editado";
  fromStage: ItemStage | null;
  toStage: ItemStage | null;
  detail: string | null;
  actorId: string | null;
  createdAt: string;
}

/** Para el tablero de Diseño: el ítem con su proyecto y las diseñadoras del proyecto (para asignar). */
export interface BoardItem extends ProjectItem {
  projectName: string;
  designers: DesignerOption[];
}

/** Hasta este tamaño se sube un archivo de diseño (las presentaciones en PDF suelen pesar varios MB). */
export const ITEM_FILE_MAX = 30 * 1024 * 1024;
