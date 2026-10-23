"use client";

import type { OrderStatus, RequestStatus } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { useTa, type VariantRef } from "../shared";

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
