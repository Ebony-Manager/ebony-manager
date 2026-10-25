// Dashboard de empresa: los números del mes por sección (Cotizaciones,
// Proyectos, Almacén). Personal reusa computeAdminDashboard y
// summarizeAttendance. Puro: lo calcula la página en el servidor.

import type { QuoteSummary } from "@/types/cotizador";
import type { Project } from "@/types/contractors";
import type { InventoryItem } from "@/types/almacen";
import { stockStatus } from "@/lib/almacen/inventory";

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export interface QuotesMonth {
  count: number;
  total: number;
  approvedCount: number;
  approvedTotal: number;
  /** Cotizado el mes anterior (para la flecha). */
  prevTotal: number;
  /** Enviadas sin respuesta (de cualquier fecha). */
  sentCount: number;
  sentTotal: number;
  /** Borradores (de cualquier fecha). */
  drafts: number;
}

/** Cotizaciones por fecha de la cotización; las abiertas cuentan todas. */
export function quotesForMonth(quotes: readonly QuoteSummary[], year: number, month: number): QuotesMonth {
  const key = monthKey(year, month);
  const prevKey = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
  const r: QuotesMonth = { count: 0, total: 0, approvedCount: 0, approvedTotal: 0, prevTotal: 0, sentCount: 0, sentTotal: 0, drafts: 0 };
  for (const q of quotes) {
    const k = q.quoteDate.slice(0, 7);
    if (k === key) {
      r.count += 1;
      r.total += q.total;
      if (q.status === "APROBADA") {
        r.approvedCount += 1;
        r.approvedTotal += q.total;
      }
    } else if (k === prevKey) r.prevTotal += q.total;
    if (q.status === "ENVIADA") {
      r.sentCount += 1;
      r.sentTotal += q.total;
    } else if (q.status === "BORRADOR") r.drafts += 1;
  }
  return r;
}

export interface ProjectsMonth {
  active: number;
  completed: number;
  /** Creados en el mes. */
  created: number;
}

export function projectsForMonth(projects: readonly Project[], year: number, month: number): ProjectsMonth {
  const key = monthKey(year, month);
  return {
    active: projects.filter((p) => p.status === "ACTIVE").length,
    completed: projects.filter((p) => p.status === "COMPLETED").length,
    created: projects.filter((p) => p.createdAt.slice(0, 7) === key).length,
  };
}

export interface StockSnapshot {
  /** Existencias × último costo; null si el usuario no ve costos. */
  valueCents: number | null;
  out: number;
  low: number;
  /** Productos (variantes) activos. */
  variants: number;
}

export function stockSnapshot(items: readonly InventoryItem[]): StockSnapshot {
  const variants = items.filter((i) => i.active).flatMap((i) => i.variants.filter((v) => v.active));
  const anyCost = variants.some((v) => v.unitCostCents != null);
  return {
    valueCents: anyCost ? variants.reduce((s, v) => s + (v.unitCostCents == null ? 0 : Math.round(Math.max(v.stockQty, 0) * v.unitCostCents)), 0) : null,
    out: variants.filter((v) => stockStatus(v) === "sin").length,
    low: variants.filter((v) => stockStatus(v) === "bajo").length,
    variants: variants.length,
  };
}

/** % de cambio contra el anterior; null si no hay base. */
export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}
