import { describe, expect, it } from "vitest";

import type { InventoryItem, InventoryMovement, PurchaseOrder } from "@/types/almacen";
import { idleStock, spendBySupplier, summarizeConsumption } from "./summary";

const item = (id: string, variants: { id: string; stock: number; cost: number | null }[]): InventoryItem =>
  ({
    id,
    name: id,
    categoryId: null,
    unit: "unidad",
    allowsDecimals: false,
    kind: "suministro",
    notes: null,
    photoPath: null,
    active: true,
    suppliers: [],
    variants: variants.map((v, i) => ({ id: v.id, itemId: id, label: "", stockQty: v.stock, minQty: null, reorderQty: null, sortOrder: i, active: true, unitCostCents: v.cost, packLabel: null, packQty: null })),
  }) as InventoryItem;

const out = (variantId: string, qty: number, movedOn: string, issueId: string, who = "e1", project: string | null = "p1"): InventoryMovement => ({
  id: `${variantId}-${movedOn}-${issueId}`,
  variantId,
  kind: "salida",
  qty: -qty,
  stockAfter: 0,
  movedOn,
  createdByName: null,
  createdAt: `${movedOn}T10:00:00Z`,
  issueId,
  issue: { employeeId: who, contractorId: null, projectId: project, internalUse: project ? null : "taller" },
  supplierId: null,
  adjustment: null,
});

describe("summarizeConsumption", () => {
  const items = [item("tornillo", [{ id: "t1", stock: 100, cost: 5 }]), item("cinta", [{ id: "c1", stock: 3, cost: null }])];
  const movs = [
    out("t1", 10, "2026-10-02", "i1"),
    out("c1", 1, "2026-10-02", "i1"),
    out("t1", 5, "2026-10-09", "i2", "e2", null),
    out("t1", 7, "2026-09-20", "i3"),
  ];

  it("cuenta salidas, lo más usado, proyectos y personas del mes", () => {
    const s = summarizeConsumption(movs, items, { year: 2026, month: 10 });
    expect(s).toMatchObject({ issues: 2, lines: 3, products: 2, valueCents: 75 });
    expect(s.mostUsed[0]).toMatchObject({ variantId: "t1", times: 2, qty: 15, valueCents: 75 });
    expect(s.byProject).toEqual([
      { key: "p1", times: 2 },
      { key: "uso:taller", times: 1 },
    ]);
    expect(s.byPerson[0]).toEqual({ key: "e1", times: 2 });
  });

  it("el año junta los meses", () => {
    expect(summarizeConsumption(movs, items, { year: 2026, month: null }).mostUsed[0]).toMatchObject({ times: 3, qty: 22 });
  });
});

describe("idleStock", () => {
  it("lo que tiene existencia y no salió en 60 días (lo que nunca salió primero)", () => {
    const items = [item("a", [{ id: "a1", stock: 5, cost: null }]), item("b", [{ id: "b1", stock: 2, cost: null }]), item("c", [{ id: "c1", stock: 0, cost: null }])];
    const rows = idleStock([out("a1", 1, "2026-07-01", "x"), out("b1", 1, "2026-10-20", "y")], items, "2026-10-25");
    expect(rows.map((r) => r.variantId)).toEqual(["a1"]);
    const never = idleStock([], items, "2026-10-25");
    expect(never.map((r) => [r.variantId, r.lastOut])).toEqual([
      ["a1", null],
      ["b1", null],
    ]);
  });
});

describe("spendBySupplier", () => {
  it("suma pedidos del período sin los cancelados", () => {
    const order = (supplierId: string, status: PurchaseOrder["status"], orderedOn: string, cents: (number | null)[]): PurchaseOrder => ({
      id: `${supplierId}${orderedOn}${status}`,
      supplierId,
      status,
      delivery: null,
      orderedOn,
      invoiceRef: null,
      notes: null,
      createdByName: null,
      createdAt: "",
      lines: cents.map((c, i) => ({ id: `${i}`, variantId: null, description: "", qty: 1, receivedQty: 0, unit: null, totalCents: c })),
    });
    const rows = spendBySupplier(
      [order("s1", "recibido", "2026-10-03", [1000, 500]), order("s2", "pedido", "2026-10-10", [null]), order("s1", "cancelado", "2026-10-11", [9000]), order("s1", "pedido", "2026-09-01", [1])],
      { year: 2026, month: 10 },
    );
    expect(rows).toEqual([
      { supplierId: "s1", orders: 1, totalCents: 1500 },
      { supplierId: "s2", orders: 1, totalCents: null },
    ]);
  });
});
