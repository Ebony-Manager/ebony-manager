import { CircleCheck, PackageX, TriangleAlert, type LucideIcon } from "lucide-react";

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
