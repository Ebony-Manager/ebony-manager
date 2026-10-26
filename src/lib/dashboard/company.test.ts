import { describe, expect, it } from "vitest";

import type { QuoteSummary } from "@/types/cotizador";
import type { Project } from "@/types/contractors";
import type { InventoryItem } from "@/types/almacen";
import { pctChange, projectsForMonth, quotesForMonth, stockSnapshot } from "./company";

const quote = (quoteDate: string, status: QuoteSummary["status"], total: number): QuoteSummary => ({
  id: `${quoteDate}-${status}-${total}`,
  number: "1",
  clientName: "",
  designerName: "",
  projectName: "",
  quoteDate,
  status,
  total,
  updatedAt: quoteDate,
});

describe("quotesForMonth", () => {
  it("cuenta el mes, el anterior (cruzando el año) y las abiertas de cualquier fecha", () => {
    const r = quotesForMonth(
      [
        quote("2026-01-10", "APROBADA", 1000),
        quote("2026-01-20", "ENVIADA", 500),
        quote("2025-12-05", "BORRADOR", 300),
        quote("2025-11-05", "ENVIADA", 200),
      ],
      2026,
      1,
    );
    expect(r).toEqual({ count: 2, total: 1500, approvedCount: 1, approvedTotal: 1000, prevTotal: 300, sentCount: 2, sentTotal: 700, drafts: 1 });
  });
});

describe("projectsForMonth", () => {
  it("activos, terminados y creados en el mes", () => {
    const p = (status: Project["status"], createdAt: string) => ({ status, createdAt }) as Project;
    expect(projectsForMonth([p("ACTIVE", "2026-10-02T12:00:00Z"), p("ACTIVE", "2026-09-30T12:00:00Z"), p("COMPLETED", "2026-10-15T00:00:00Z")], 2026, 10)).toEqual({
      active: 2,
      completed: 1,
      created: 2,
    });
  });
});

describe("stockSnapshot", () => {
  const item = (variants: Partial<InventoryItem["variants"][number]>[], active = true) =>
    ({ active, variants: variants.map((v) => ({ active: true, minQty: null, unitCostCents: null, stockQty: 0, ...v })) }) as InventoryItem;

  it("valor al último costo y conteo de sin stock / bajo stock (solo activos)", () => {
    const r = stockSnapshot([
      item([{ stockQty: 4, unitCostCents: 250, minQty: 2 }, { stockQty: 0, minQty: 1 }]),
      item([{ stockQty: 1, minQty: 5, unitCostCents: 100 }]),
      item([{ stockQty: 0, minQty: 1 }], false),
    ]);
    expect(r).toEqual({ valueCents: 1100, out: 1, low: 1, variants: 3 });
  });

  it("sin costos visibles el valor es null", () => {
    expect(stockSnapshot([item([{ stockQty: 3 }])]).valueCents).toBeNull();
  });
});

describe("pctChange", () => {
  it("null sin base", () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(15, 10)).toBe(50);
  });
});
