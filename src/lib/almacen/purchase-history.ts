import type { PurchaseOrder, PurchaseOrderLine, PurchaseRequest } from "@/types/almacen";

export type PurchaseHistoryStatus = "all" | "recibido" | "cancelado";
export const PURCHASE_HISTORY_DEFAULT_STATUS: PurchaseHistoryStatus = "recibido";

export interface PurchaseHistoryRow {
  id: string;
  variantId: string | null;
  description: string;
  qty: number;
  unit: string | null;
  status: "recibido" | "cancelado";
  supplierId: string | null;
  orderId: string | null;
  /** Order date, or request creation date; not a receipt/cancellation timestamp. */
  date: string;
  requests: PurchaseRequest[];
}

export function outstandingPurchaseLines(order: PurchaseOrder): PurchaseOrderLine[] {
  return order.status === "pedido" || order.status === "parcial"
    ? order.lines.filter((line) => line.receivedQty < line.qty)
    : [];
}

/** One history row per purchased line or standalone closed request.
 * Deduplicate only by explicit line identity, never product name/variant:
 * repeated purchases and cancelled attempts must remain traceable.
 */
export function purchaseHistory(orders: PurchaseOrder[], requests: PurchaseRequest[]): PurchaseHistoryRow[] {
  const linked = new Map<string, PurchaseRequest[]>();
  for (const request of requests) {
    if (request.orderLineId) linked.set(request.orderLineId, [...(linked.get(request.orderLineId) ?? []), request]);
  }
  const represented = new Set<string>();
  const rows: PurchaseHistoryRow[] = [];
  for (const order of orders) {
    for (const line of order.lines) {
      const closed = order.status === "cancelado" || order.status === "recibido" || line.receivedQty >= line.qty;
      if (!closed) continue;
      represented.add(line.id);
      rows.push({
        id: `line:${line.id}`, variantId: line.variantId, description: line.description,
        qty: line.qty, unit: line.unit,
        status: order.status === "cancelado" ? "cancelado" : "recibido",
        supplierId: order.supplierId, orderId: order.id, date: order.orderedOn,
        requests: linked.get(line.id) ?? [],
      });
    }
  }
  for (const request of requests) {
    if (request.status !== "cancelado" && request.status !== "recibido") continue;
    if (request.orderLineId && represented.has(request.orderLineId)) continue;
    rows.push({
      id: `request:${request.id}`, variantId: request.variantId, description: request.description,
      qty: request.qty, unit: request.unit, status: request.status,
      supplierId: request.supplierId, orderId: null, date: request.createdAt,
      requests: [request],
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
