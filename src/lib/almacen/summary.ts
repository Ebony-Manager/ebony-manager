// Resumen del Almacén: qué se usa más y menos, en qué proyectos, quién
// retira, qué no se mueve y a quién le compramos. Puro (sin Supabase); lo
// pinta Almacén → Resumen.

import type { InventoryItem, InventoryMovement, PurchaseOrder } from "@/types/almacen";

export interface PeriodFilter {
  year: number;
  /** null = todo el año. */
  month: number | null;
}

const inPeriod = (date: string, p: PeriodFilter) => {
  const [y, m] = date.split("-").map(Number);
  return y === p.year && (p.month === null || m === p.month);
};

export interface UsageRow {
  variantId: string;
  /** Veces que salió (una por línea de salida). */
  times: number;
  /** Cantidad total que salió, en la unidad del producto. */
  qty: number;
  /** Valor al último costo conocido (null sin permiso de costos). */
  valueCents: number | null;
}

export interface CountRow {
  key: string;
  times: number;
}

export interface ConsumptionSummary {
  issues: number;
  lines: number;
  products: number;
  valueCents: number | null;
  mostUsed: UsageRow[];
  byProject: CountRow[];
  byPerson: CountRow[];
}

/** Salidas del período: lo más usado, por proyecto (o uso interno) y por quién retiró. */
export function summarizeConsumption(movements: readonly InventoryMovement[], items: readonly InventoryItem[], period: PeriodFilter): ConsumptionSummary {
  const cost = new Map(items.flatMap((i) => i.variants.map((v) => [v.id, v.unitCostCents] as const)));
  const usage = new Map<string, UsageRow>();
  const projects = new Map<string, number>();
  const people = new Map<string, number>();
  let lines = 0;
  let anyCost = false;
  let valueCents = 0;
  const issueIds = new Set<string>();
  for (const m of movements) {
    if (m.kind !== "salida" || !inPeriod(m.movedOn, period)) continue;
    lines += 1;
    const qty = Math.abs(m.qty);
    const unit = cost.get(m.variantId) ?? null;
    const row = usage.get(m.variantId) ?? { variantId: m.variantId, times: 0, qty: 0, valueCents: null };
    row.times += 1;
    row.qty += qty;
    if (unit != null) {
      anyCost = true;
      row.valueCents = (row.valueCents ?? 0) + Math.round(qty * unit);
      valueCents += Math.round(qty * unit);
    }
    usage.set(m.variantId, row);
    if (m.issue) {
      const project = m.issue.projectId ?? (m.issue.internalUse ? `uso:${m.issue.internalUse}` : "none");
      projects.set(project, (projects.get(project) ?? 0) + 1);
      const person = m.issue.employeeId ?? m.issue.contractorId ?? "none";
      people.set(person, (people.get(person) ?? 0) + 1);
    }
    if (m.issueId) issueIds.add(m.issueId);
  }
  const sortCounts = (map: Map<string, number>) =>
    [...map.entries()].map(([key, times]) => ({ key, times })).sort((a, b) => b.times - a.times || a.key.localeCompare(b.key));
  return {
    issues: issueIds.size,
    lines,
    products: usage.size,
    valueCents: anyCost ? valueCents : null,
    mostUsed: [...usage.values()].sort((a, b) => b.times - a.times || b.qty - a.qty),
    byProject: sortCounts(projects),
    byPerson: sortCounts(people),
  };
}

export interface IdleRow {
  variantId: string;
  stockQty: number;
  /** Fecha de la última salida, o null si nunca salió. */
  lastOut: string | null;
}

/**
 * Lo que hay en existencia pero no ha salido en `days` días (o nunca):
 * dinero parado en el almacén. Lo que nunca salió va primero.
 */
export function idleStock(movements: readonly InventoryMovement[], items: readonly InventoryItem[], today: string, days = 60): IdleRow[] {
  const lastOut = new Map<string, string>();
  for (const m of movements) {
    if (m.kind !== "salida") continue;
    const prev = lastOut.get(m.variantId);
    if (!prev || m.movedOn > prev) lastOut.set(m.variantId, m.movedOn);
  }
  const cutoff = new Date(`${today}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - days);
  const limit = cutoff.toISOString().slice(0, 10);
  return items
    .filter((i) => i.active)
    .flatMap((i) => i.variants.filter((v) => v.active && v.stockQty > 0))
    .map((v) => ({ variantId: v.id, stockQty: v.stockQty, lastOut: lastOut.get(v.id) ?? null }))
    .filter((r) => r.lastOut === null || r.lastOut < limit)
    .sort((a, b) => (a.lastOut ?? "").localeCompare(b.lastOut ?? ""));
}

export interface SupplierSpend {
  supplierId: string;
  orders: number;
  /** Suma de lo facturado (null si no hay costos visibles). */
  totalCents: number | null;
}

/** Pedidos del período por proveedor (sin los cancelados). */
export function spendBySupplier(orders: readonly PurchaseOrder[], period: PeriodFilter): SupplierSpend[] {
  const map = new Map<string, SupplierSpend>();
  for (const o of orders) {
    if (o.status === "cancelado" || !inPeriod(o.orderedOn, period)) continue;
    const row = map.get(o.supplierId) ?? { supplierId: o.supplierId, orders: 0, totalCents: null };
    row.orders += 1;
    for (const l of o.lines) if (l.totalCents != null) row.totalCents = (row.totalCents ?? 0) + l.totalCents;
    map.set(o.supplierId, row);
  }
  return [...map.values()].sort((a, b) => (b.totalCents ?? 0) - (a.totalCents ?? 0) || b.orders - a.orders);
}
