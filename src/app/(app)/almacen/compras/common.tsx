"use client";

import { RefreshCw, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus, RequestStatus } from "@/types/almacen";
import { StatusBadge as SharedStatusBadge } from "@/components/shared/status-badge";
import { formatQty, purchasePack, packText, toPacks, type PurchasePack } from "@/lib/almacen/inventory";
import { ItemThumb, qtyWithUnit, useTa, type VariantRef } from "../shared";

/** El estado de una solicitud o pedido: ícono y tono del registro (lib/ui/status.ts). */
export function StatusBadge({ status }: { status: RequestStatus | OrderStatus }) {
  const { ta } = useTa();
  return <SharedStatusBadge status={`purchase_${status}`}>{ta(`st_${status}`)}</SharedStatusBadge>;
}

/** Nombre de lo pedido: el producto del catálogo o el texto libre. */
export function requestName(r: { variantId: string | null; description: string }, index: Map<string, VariantRef>): string {
  return (r.variantId && index.get(r.variantId)?.name) || r.description;
}

/**
 * De dónde salió una solicitud: automática (el producto llegó a su mínimo),
 * en azul para distinguirla de un vistazo, o manual (quién la pidió).
 */
export function RequestOrigin({ r }: { r: { auto: boolean; createdByName: string | null } }) {
  const { ta } = useTa();
  if (r.auto)
    return (
      <span title={ta("auto_hint")} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
        <RefreshCw className="size-3" />
        {ta("auto_badge")}
      </span>
    );
  if (!r.createdByName) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <User className="size-3" />
      {r.createdByName}
    </span>
  );
}

/** The catalog photo is shared by a product's variants; free-text requests get a placeholder. */
export function PurchasePhoto({ variantId, index, photoPath }: { variantId: string | null; index: Map<string, VariantRef>; photoPath?: string | null }) {
  return <ItemThumb path={(variantId && index.get(variantId)?.item.photoPath) || photoPath || null} size={48} />;
}

/** La presentación en que se compra este producto (rollo, galón); null = suelto o texto libre. */
export function packOf(index: Map<string, VariantRef>, variantId: string | null): PurchasePack | null {
  const ref = variantId ? index.get(variantId) : undefined;
  return ref ? purchasePack(ref.variant) : null;
}

/** "2 × Rollo de 500 cm (56 unidades)", o "12 unidades" si se compra suelto. */
export function purchaseQtyText(qty: number, unit: string | null, pack: PurchasePack | null, lang: "es" | "en"): string {
  return pack ? `${packText(qty, pack, lang)} (${qtyWithUnit(qty, unit, lang)})` : qtyWithUnit(qty, unit, lang);
}

/**
 * La cantidad de una línea de compra, en dos renglones para que no aplaste al nombre: arriba lo pedido
 * (o «recibido de pedido») en presentaciones —«2 × Rollo de 100 m»— y, si hay presentación, debajo y más
 * tenue el total en la unidad del almacén —«200 metros»—. Puede partirse en renglones; nunca se corta.
 */
export function PurchaseQty({
  qty,
  receivedQty,
  unit,
  pack,
  lang,
  className,
}: {
  qty: number;
  /** Si se pasa, muestra «recibido de pedido». */
  receivedQty?: number;
  unit: string | null;
  pack: PurchasePack | null;
  lang: "es" | "en";
  className?: string;
}) {
  const { ta } = useTa();
  const ordered = pack ? packText(qty, pack, lang) : qtyWithUnit(qty, unit, lang);
  const main =
    receivedQty != null ? ta("received_of", { a: formatQty(pack ? toPacks(receivedQty, pack) : receivedQty, lang), b: ordered }) : ordered;
  return (
    <span className={cn("max-w-[50%] text-right tabular-nums", className)}>
      <span className="block">{main}</span>
      {pack && <span className="block text-xs text-muted-foreground">{qtyWithUnit(qty, unit, lang)}</span>}
    </span>
  );
}
