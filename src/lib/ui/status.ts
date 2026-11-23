import { Ban, Briefcase, CalendarX, CircleDashed, CircleDot, CirclePause, Flag, Hammer, PaintBucket, CircleCheck, CircleX, Clock, FilePen, HandHelping, PackageCheck, PackageOpen, PackageX, Send, ShieldAlert, SearchX, Truck, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";

/**
 * Los estados de la app, cada uno con UN ícono y UN tono (colores del tema),
 * definidos una sola vez (ver UI-RULES.md). La etiqueta de una fila y la
 * opción del filtro que la selecciona usan el mismo: así "Sin stock" se ve
 * igual en la lista, en el filtro y en un resumen. El color nunca es la única
 * señal: siempre va con su ícono (y su texto).
 *
 * Un estado nuevo se agrega acá primero, y después se usa con <StatusBadge>
 * y en `options` de los filtros (`icon: STATUS.stock_out.icon`).
 */
export type StatusTone = "ok" | "warn" | "error" | "info" | "muted";

export interface StatusDef {
  icon: LucideIcon;
  tone: StatusTone;
}

export const STATUS = {
  stock_ok: { icon: CircleCheck, tone: "ok" },
  stock_low: { icon: TriangleAlert, tone: "warn" },
  stock_out: { icon: PackageX, tone: "error" },
  // Inspecciones: un detalle (o una obra/visita con detalles) pendiente o ya resuelto
  insp_pendiente: { icon: Clock, tone: "warn" },
  insp_resuelto: { icon: CircleCheck, tone: "ok" },
  // Diseño: la etapa de cada ítem (mueble) de un proyecto
  item_por_medir: { icon: CircleDashed, tone: "muted" },
  item_en_diseno: { icon: FilePen, tone: "info" },
  item_con_cliente: { icon: Send, tone: "warn" },
  item_aprobado: { icon: CircleCheck, tone: "ok" },
  item_en_produccion: { icon: Hammer, tone: "info" },
  // Orden de producción (Diseño → revisión de Brainer → pedidos → taller).
  order_borrador: { icon: FilePen, tone: "muted" },
  order_en_revision: { icon: Send, tone: "warn" },
  order_por_corregir: { icon: TriangleAlert, tone: "error" },
  order_aprobada: { icon: CircleCheck, tone: "ok" },
  order_pedida: { icon: Truck, tone: "info" },
  order_en_taller: { icon: Hammer, tone: "info" },
  order_cancelada: { icon: CircleX, tone: "muted" },
  // Cotizaciones
  quote_BORRADOR: { icon: FilePen, tone: "muted" },
  quote_ENVIADA: { icon: Send, tone: "warn" },
  quote_APROBADA: { icon: CircleCheck, tone: "ok" },
  quote_RECHAZADA: { icon: CircleX, tone: "error" },
  // Compras (solicitudes y pedidos)
  purchase_pendiente: { icon: Clock, tone: "warn" },
  purchase_pedido: { icon: Truck, tone: "info" },
  purchase_parcial: { icon: PackageOpen, tone: "info" },
  purchase_recibido: { icon: PackageCheck, tone: "ok" },
  purchase_cancelado: { icon: CircleX, tone: "muted" },
  // Herramientas (el estado que se ve: «vencida» es una prestada que pasó su fecha)
  tool_disponible: { icon: CircleCheck, tone: "ok" },
  tool_prestada: { icon: HandHelping, tone: "info" },
  tool_vencida: { icon: CalendarX, tone: "error" },
  tool_reparacion: { icon: Wrench, tone: "warn" },
  tool_danada: { icon: ShieldAlert, tone: "error" },
  tool_perdida: { icon: SearchX, tone: "muted" },
  // Personal y contratistas
  record_active: { icon: CircleCheck, tone: "ok" },
  record_inactive: { icon: CirclePause, tone: "muted" },
  closing_paid: { icon: CircleCheck, tone: "ok" },
  // Contratos: en curso, ya pagado pero sin cerrar, terminado, y sin valor (¿vacío o duplicado?)
  contract_in_progress: { icon: Hammer, tone: "info" },
  contract_to_close: { icon: Flag, tone: "warn" },
  contract_completed: { icon: CircleCheck, tone: "muted" },
  contract_no_value: { icon: CircleDashed, tone: "muted" },
  closing_draft: { icon: FilePen, tone: "muted" },
  kind_employee: { icon: Briefcase, tone: "info" },
  kind_contractor: { icon: Hammer, tone: "muted" },
  contractor_ebanista: { icon: Hammer, tone: "muted" },
  contractor_pintor: { icon: PaintBucket, tone: "muted" },
  // Trabajos de Taller
  work_por_hacer: { icon: Clock, tone: "muted" },
  work_en_proceso: { icon: Hammer, tone: "info" },
  work_listo: { icon: CircleCheck, tone: "ok" },
  work_cancelado: { icon: CircleX, tone: "muted" },
  /** Proyectos: en curso o terminado. */
  project_active: { icon: CircleDot, tone: "info" },
  project_completed: { icon: CircleCheck, tone: "muted" },
  /** El filtro «Fuera de uso» junta reparación, dañada y perdida. */
  tool_out: { icon: Ban, tone: "muted" },
} satisfies Record<string, StatusDef>;

export type StatusKey = keyof typeof STATUS;

/** Clases de texto del tono, del tema (para el ícono suelto de un filtro o una lista). */
export const TONE_TEXT: Record<StatusTone, string> = {
  ok: "text-success",
  warn: "text-warning",
  error: "text-destructive",
  info: "text-primary",
  muted: "text-muted-foreground",
};
