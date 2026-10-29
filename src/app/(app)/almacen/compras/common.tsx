"use client";

import { RefreshCw, User } from "lucide-react";
import type { OrderStatus, RequestStatus } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { purchasePack, packText, type PurchasePack } from "@/lib/almacen/inventory";
import { ItemThumb, qtyWithUnit, useTa, type VariantRef } from "../shared";

const STATUS_BADGE: Record<RequestStatus | OrderStatus, "warning" | "secondary" | "success" | "outline"> = {
  pendiente: "warning",
  pedido: "secondary",
  parcial: "secondary",
  recibido: "success",
  cancelado: "outline",
};

export function StatusBadge({ status }: { status: RequestStatus | OrderStatus }) {
  const { ta } = useTa();
  return <Badge variant={STATUS_BADGE[status]}>{ta(`st_${status}`)}</Badge>;
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
export function PurchasePhoto({ variantId, index }: { variantId: string | null; index: Map<string, VariantRef> }) {
  return <ItemThumb path={(variantId && index.get(variantId)?.item.photoPath) || null} size={48} />;
}

/** La presentación en que se le compra este producto a ese proveedor (o al principal); null = suelto o texto libre. */
export function packOf(index: Map<string, VariantRef>, variantId: string | null, supplierId?: string | null): PurchasePack | null {
  const ref = variantId ? index.get(variantId) : undefined;
  return ref ? purchasePack(ref.item, ref.variant, supplierId) : null;
}

/** "2 × Rollo de 500 cm (56 unidades)", o "12 unidades" si se compra suelto. */
export function purchaseQtyText(qty: number, unit: string | null, pack: PurchasePack | null, lang: "es" | "en"): string {
  return pack ? `${packText(qty, pack, lang)} (${qtyWithUnit(qty, unit, lang)})` : qtyWithUnit(qty, unit, lang);
}
