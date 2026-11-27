// Tipos del Almacén (Etapa 1): proveedores, catálogo con variantes y
// existencias, salidas, solicitudes de compra, pedidos y ajustes. Ver
// supabase/migrations/20261024100000_almacen.sql.

export const INVENTORY_UNITS = [
  "unidad",
  "metro",
  "caja",
  "galon",
  "botella",
  "lamina",
  "rollo",
  "par",
  "juego",
  "kilo",
  "pliego",
  "bolsa",
] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

/** Unidades de una solicitud de texto libre: las del catálogo más «lote» (lo especial con su detalle en un archivo). */
export const REQUEST_UNITS = [...INVENTORY_UNITS, "lote"] as const;
export type RequestUnit = (typeof REQUEST_UNITS)[number];

export type SupplierKind = "materiales" | "servicio";
export type ItemKind = "suministro" | "devolvible";
export type InternalUse = "taller" | "embalaje" | "pintura";
export const INTERNAL_USES: InternalUse[] = ["taller", "embalaje", "pintura"];
export type RequestStatus = "pendiente" | "pedido" | "recibido" | "cancelado";
export type OrderStatus = "pedido" | "parcial" | "recibido" | "cancelado";
/** ¿Lo trae el proveedor o hay que ir a buscarlo? (alimenta la agenda de transporte). */
export type OrderDelivery = "entrega" | "retiro";
export type AdjustmentReason = "inicial" | "conteo" | "dano" | "perdida" | "correccion";
export const ADJUSTMENT_REASONS: AdjustmentReason[] = ["conteo", "inicial", "dano", "perdida", "correccion"];

/** Rubros del Directorio (lista fija; la base la valida igual). */
export type SupplierRubro =
  | "ferreteria"
  | "herrajes"
  | "madera_laminas"
  | "iluminacion"
  | "pintura"
  | "vidrios"
  | "tecnico_maquinaria"
  | "mecanico"
  | "transporte"
  | "mantenimiento"
  | "subcontrato";
export const SUPPLIER_RUBROS: Record<SupplierKind, SupplierRubro[]> = {
  materiales: ["ferreteria", "herrajes", "madera_laminas", "iluminacion", "pintura", "vidrios"],
  servicio: ["tecnico_maquinaria", "mecanico", "transporte", "mantenimiento", "subcontrato"],
};
export const ALL_SUPPLIER_RUBROS: SupplierRubro[] = [...SUPPLIER_RUBROS.materiales, ...SUPPLIER_RUBROS.servicio];

/** Una persona del proveedor (oficina, dueña, vendedora, gerente…); casi todo es por WhatsApp. */
export interface SupplierContact {
  name: string;
  /** Cargo o de qué se encarga ("Oficina", "Dueña"…). */
  role: string;
  whatsapp: string;
}

export interface Supplier {
  id: string;
  name: string;
  kind: SupplierKind;
  /** Uno o varios; el primero es el principal (agrupa la lista). */
  rubros: SupplierRubro[];
  /** Texto libre: de qué es técnico, qué marca maneja… */
  specialty: string | null;
  /** Contactos; el primero es el principal (su nombre y WhatsApp se copian a `contactName` / `whatsapp`). */
  contacts: SupplierContact[];
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
}

export interface InventoryCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface InventoryVariant {
  id: string;
  itemId: string;
  /** "" = variante única. */
  label: string;
  stockQty: number;
  minQty: number | null;
  /** Pedir hasta. */
  reorderQty: number | null;
  sortOrder: number;
  active: boolean;
  /** Último costo por unidad base, en centavos (solo con Compras o Costos). */
  unitCostCents: number | null;
  /** Presentación de compra de esta variante ("Galón" = 10 botellas); manda sobre la del proveedor. */
  packLabel: string | null;
  packQty: number | null;
}

export interface ItemSupplier {
  supplierId: string;
  isPrimary: boolean;
  supplierRef: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  categoryId: string | null;
  unit: InventoryUnit;
  allowsDecimals: boolean;
  kind: ItemKind;
  notes: string | null;
  /** Ruta de la foto en el bucket público `inventory-photos` (ver inventoryPhotoUrl). */
  photoPath: string | null;
  active: boolean;
  variants: InventoryVariant[];
  suppliers: ItemSupplier[];
}

export interface InventoryPerson {
  kind: "empleado" | "contratista";
  id: string;
  name: string;
  active: boolean;
  contractorType: string | null;
  /** Ruta de la foto de perfil (bucket employee-photos o contractor-photos según `kind`). */
  photoPath: string | null;
}

export interface MovementLine {
  variantId: string;
  qty: number;
  stockAfter: number;
}

export interface InventoryIssue {
  id: string;
  issuedOn: string;
  employeeId: string | null;
  contractorId: string | null;
  projectId: string | null;
  internalUse: InternalUse | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  lines: MovementLine[];
}

export interface PurchaseRequest {
  id: string;
  variantId: string | null;
  /** Proveedor elegido al pedir o en Por pedir; null = el principal del producto. */
  supplierId: string | null;
  /** Precio por unidad base que pone Compras en Por pedir (centavos; solo con Compras o Costos). */
  unitCostCents: number | null;
  description: string;
  qty: number;
  unit: string | null;
  projectId: string | null;
  reason: string | null;
  status: RequestStatus;
  auto: boolean;
  /** Especial para proyecto: al recibirla queda en Apartados (antes «Guardado por proyecto») (no suma al inventario). */
  forProject: boolean;
  /** Foto de lo que se pide (sobre todo lo especial): pasa al apartado al recibirlo. */
  photoPath: string | null;
  /** La cotización o factura del proveedor (PDF o foto) con el detalle de un pedido por lote. */
  attachmentPath: string | null;
  attachmentName: string | null;
  orderLineId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  variantId: string | null;
  description: string;
  qty: number;
  receivedQty: number;
  unit: string | null;
  /** Costo total de la línea según factura (solo con Compras o Costos). */
  totalCents: number | null;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: OrderStatus;
  /** null = sin definir (pedidos viejos). */
  delivery: OrderDelivery | null;
  orderedOn: string;
  invoiceRef: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  lines: PurchaseOrderLine[];
}

/** Un movimiento del inventario (historial): de dónde vino y cómo quedó. */
export interface InventoryMovement {
  id: string;
  variantId: string;
  kind: "salida" | "recepcion" | "ajuste";
  /** Con signo: negativo sale, positivo entra. */
  qty: number;
  stockAfter: number;
  movedOn: string;
  createdByName: string | null;
  createdAt: string;
  /** La salida a la que pertenece (varias líneas = una salida). */
  issueId: string | null;
  /** Salida: a quién y para qué. */
  issue: { employeeId: string | null; contractorId: string | null; projectId: string | null; internalUse: InternalUse | null } | null;
  /** Recepción de compra: el proveedor del pedido. */
  supplierId: string | null;
  /** Ajuste: motivo y nota. */
  adjustment: { reason: AdjustmentReason; notes: string | null } | null;
}

export interface InventoryAdjustment {
  id: string;
  adjustedOn: string;
  reason: AdjustmentReason;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  lines: MovementLine[];
}

/** Una línea de lo que salió del almacén para un proyecto (Proyecto → Suministros). */
export interface ProjectSupplyLine {
  id: string;
  issuedOn: string;
  issueId: string;
  variantId: string;
  name: string;
  photoPath: string | null;
  unit: string;
  qty: number;
  recipient: string | null;
  /** Último costo por unidad (centavos); null sin Costos del almacén o sin costo cargado. */
  unitCostCents: number | null;
}

// ── Herramientas (Etapa 2) ───────────────────────────────────────────────

export const TOOL_CATEGORIES = ["electrica", "manual", "medicion", "corte", "otra"] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolStatus = "disponible" | "prestada" | "reparacion" | "danada" | "perdida";
export type ToolCondition = "bien" | "reparacion" | "danada" | "perdida";

export interface Tool {
  id: string;
  name: string;
  /** "Engalletadora #1"; null = sin número. */
  number: number | null;
  category: ToolCategory;
  brand: string | null;
  notes: string | null;
  photoPath: string | null;
  status: ToolStatus;
  active: boolean;
}

export interface ToolLoan {
  id: string;
  toolId: string;
  employeeId: string | null;
  contractorId: string | null;
  projectId: string | null;
  lentOn: string;
  /** La fecha pactada o, sin fecha, a los 7 días. */
  dueOn: string;
  /** Se puso fecha al prestar (si no, vence a los 7 días). */
  hasDueDate: boolean;
  returnedOn: string | null;
  returnCondition: ToolCondition | null;
  notes: string | null;
  returnNotes: string | null;
  lentByName: string | null;
  returnedByName: string | null;
}

/** Lo que una persona tiene por devolver: una herramienta o un envase. */
export interface PendingReturn {
  kind: "herramienta" | "envase";
  /** Préstamo (herramienta) o línea de la salida (envase). */
  id: string;
  name: string;
  photoPath: string | null;
  employeeId: string | null;
  contractorId: string | null;
  person: string | null;
  since: string;
  dueOn: string | null;
  overdue: boolean;
  qty: number;
  unit: string | null;
  project: string | null;
}

/** Para qué es una línea de un pedido (lo que almacén necesita saber al recibir). */
export interface LineDestination {
  lineId: string;
  /** Especial para proyecto: al recibirla va a Apartados. */
  forProject: boolean;
  projectId: string | null;
  projectName: string | null;
  photoPath: string | null;
  notes: string | null;
  requestedBy: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
}

// ── Apartados (antes «Guardado por proyecto») ──────────────────────────────────────────────────

/** De dónde salió: Compras (solicitud especial recibida), Ebony lo compró por su lado, o lo trajo el cliente. */
export type StoredOrigin = "compra" | "directa" | "cliente";
export type StoredStatus = "en_almacen" | "entregado";

/** Algo de un solo proyecto guardado en el almacén hasta usarlo (un riel especial, la manigueta del cliente). */
export interface StoredItem {
  id: string;
  projectId: string;
  projectName: string;
  projectItemId: string | null;
  projectItemName: string | null;
  description: string;
  qty: number;
  unit: string | null;
  origin: StoredOrigin;
  supplierId: string | null;
  supplierName: string | null;
  location: string | null;
  photoPath: string | null;
  notes: string | null;
  receivedOn: string;
  receivedByName: string | null;
  status: StoredStatus;
  deliveredOn: string | null;
  deliveredToName: string | null;
  deliveredByName: string | null;
  deliveryNotes: string | null;
  /** Costo total (centavos). null = sin costo o no lo puede ver. */
  totalCents: number | null;
  /** La cotización o factura del pedido (lo especial por lote). */
  attachmentPath: string | null;
  attachmentName: string | null;
}

/** Lo especial que se pidió en Compras para un proyecto y todavía no llega. */
export interface IncomingItem {
  id: string;
  projectId: string;
  projectName: string;
  description: string;
  qty: number;
  unit: string | null;
  status: "pendiente" | "pedido";
  requestedBy: string | null;
  createdAt: string;
  photoPath: string | null;
  /** Link o notas de la solicitud. */
  notes: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
}

/** A quién se le puede entregar. */
export interface StoredPerson {
  kind: "empleado" | "contratista";
  id: string;
  name: string;
  detail: string | null;
}
