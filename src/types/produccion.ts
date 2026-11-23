/** Orden de producción (ver el documento del flujo y la migración 20261124120000_orden_produccion.sql). */

export type OrderStatus = "borrador" | "en_revision" | "por_corregir" | "aprobada" | "pedida" | "en_taller" | "cancelada";
/** Las etapas en las que la orden todavía está en Diseño (se arma o se revisa). */
export const DESIGN_ORDER_STATUSES: readonly OrderStatus[] = ["borrador", "en_revision", "por_corregir"];
/** Las que se pueden editar (la diseñadora la arma o la corrige). */
export const EDITABLE_ORDER_STATUSES: readonly OrderStatus[] = ["borrador", "por_corregir"];

export type OrderFileKind = "hoja_ruta" | "despiece" | "optimizacion" | "cotizacion_proveedor" | "electricidad";
/** Los documentos que la orden necesita para enviarse (la hoja de electricidad solo si aplica). */
export const REQUIRED_ORDER_FILES: readonly OrderFileKind[] = ["hoja_ruta", "despiece", "optimizacion", "cotizacion_proveedor"];
export const ORDER_FILE_KINDS: readonly OrderFileKind[] = [...REQUIRED_ORDER_FILES, "electricidad"];

export interface OrderFile {
  id: string;
  kind: OrderFileKind;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface OrderItem {
  itemId: string;
  area: string;
  name: string;
  kind: string;
  /** null = por definir. */
  color: string | null;
  /** Hoja de medidas y presentación aprobada del ítem (vienen solas). */
  files: { driveFileId: string; name: string; kind: "medidas" | "aprobada" }[];
}

export interface LaborLine {
  id: string;
  itemId: string | null;
  rateId: string | null;
  contractorType: string;
  fase: string | null;
  unidad: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface HardwareLine {
  id: string;
  source: "inventario" | "especial";
  inventoryItemId: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
}

export interface MaterialLine {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface ProductionOrder {
  id: string;
  projectId: string;
  projectName: string;
  number: number;
  status: OrderStatus;
  statusSince: string;
  reviewNote: string | null;
  notes: string | null;
  sentAt: string | null;
  createdAt: string;
  items: OrderItem[];
  files: OrderFile[];
  labor: LaborLine[];
  hardware: HardwareLine[];
  materials: MaterialLine[];
}

/** Resumen para el tablero y la ficha del proyecto. */
export interface OrderSummary {
  id: string;
  projectId: string;
  projectName: string;
  number: number;
  status: OrderStatus;
  statusSince: string;
  itemIds: string[];
  fileKinds: OrderFileKind[];
  laborCount: number;
  colorsPending: number;
  designers: string[];
}

export interface LaborRateOption {
  id: string;
  contractorType: string;
  fase: string | null;
  unidad: string;
  descripcion: string;
  precioCents: number;
}

export interface HardwareItemOption {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
}

export interface ColorOption {
  label: string;
  fromProject: boolean;
}
