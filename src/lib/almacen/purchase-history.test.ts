import { describe, expect, it } from "vitest";
import type { PurchaseOrder, PurchaseOrderLine, PurchaseRequest } from "@/types/almacen";
import { outstandingPurchaseLines, purchaseHistory } from "./purchase-history";

const line = (id: string, receivedQty = 0): PurchaseOrderLine => ({ id, variantId: "variant", description: "Tornillos", qty: 10, receivedQty, unit: "unidad", totalCents: null });
const order = (status: PurchaseOrder["status"], lines: PurchaseOrderLine[], id = "order"): PurchaseOrder => ({ id, supplierId: "supplier", status, delivery: "retiro", orderedOn: "2026-10-27", invoiceRef: null, notes: null, createdByName: "Compras", createdAt: "2026-10-27T12:00:00Z", lines });
const request = (id: string, status: PurchaseRequest["status"], orderLineId: string | null = null): PurchaseRequest => ({ id, variantId: "variant", description: "Tornillos", supplierId: null, unitCostCents: null, qty: 10, unit: "unidad", projectId: null, reason: null, status, auto: false, orderLineId, createdBy: "user", createdByName: "Solicitante", createdAt: "2026-10-26T12:00:00Z" });

describe("purchase history by item", () => {
  it("combines closed orders and standalone requests in date order without duplicate linked requests", () => {
    const rows = purchaseHistory([order("cancelado", [line("cancelled")]), order("recibido", [line("received", 10)], "received-order")], [request("cancelled-request", "cancelado", "cancelled"), request("received-request", "recibido", "received"), request("standalone", "cancelado")]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual(["line:cancelled", "line:received", "request:standalone"]);
    expect(rows[0].requests[0].createdByName).toBe("Solicitante");
    expect(rows[2].orderId).toBeNull();
  });
  it("moves completed items from a partial order to history while leaving outstanding items in transit", () => {
    const partial = order("parcial", [line("done", 10), line("partial", 4), line("waiting")]);
    expect(purchaseHistory([partial], []).map((r) => r.id)).toEqual(["line:done"]);
    expect(outstandingPurchaseLines(partial).map((l) => l.id)).toEqual(["partial", "waiting"]);
  });
  it("keeps separate cancelled attempts for the same product and a requeued request remains pending", () => {
    const rows = purchaseHistory([order("cancelado", [line("old")]), order("cancelado", [line("retry")], "retry-order")], [request("requeued", "pendiente")]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "cancelado")).toBe(true);
  });
  it("does not drop standalone received requests or free text without a catalog entry", () => {
    const free = { ...request("free", "recibido", "unloaded-line"), variantId: null, description: "Café" };
    expect(purchaseHistory([], [free])[0]).toMatchObject({ description: "Café", variantId: null, status: "recibido", qty: 10 });
  });
  it("excludes pending requests and incomplete open lines from history", () => {
    expect(purchaseHistory([order("pedido", [line("waiting")])], [request("pending", "pendiente"), request("placed", "pedido", "waiting")])).toEqual([]);
    expect(outstandingPurchaseLines(order("cancelado", [line("cancelled")]))).toEqual([]);
  });
});
