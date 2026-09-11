import { describe, expect, it } from "vitest";

import type { ContractorLedgerRow } from "@/types/contractors";
import { groupLedgerRows, ledgerRowsTotals } from "@/lib/contractors/contractor-ledger-view";

function row(over: Partial<ContractorLedgerRow>): ContractorLedgerRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    contractorId: "c1",
    projectId: over.projectId ?? null,
    projectName: over.projectName ?? null,
    entryDate: over.entryDate ?? "2026-01-01",
    category: over.category ?? "trabajo",
    direction: over.direction ?? "a_favor",
    mt2: null,
    costPerMt2Cents: null,
    amountCents: over.amountCents ?? 0,
    ebonyAbsorbsMaterial: over.ebonyAbsorbsMaterial ?? false,
    clientText: null,
    description: null,
    notes: null,
    itemsSummary: null,
    balanceAfterCents: over.balanceAfterCents ?? 0,
  };
}

describe("groupLedgerRows", () => {
  const rows: ContractorLedgerRow[] = [
    row({ id: "a", entryDate: "2026-01-05", category: "trabajo", direction: "a_favor", amountCents: 10000, projectId: "p1", balanceAfterCents: 10000 }),
    row({ id: "b", entryDate: "2026-02-10", category: "pago", direction: "reduce", amountCents: 4000, projectId: null, balanceAfterCents: 6000 }),
    row({ id: "c", entryDate: "2026-02-20", category: "trabajo", direction: "a_favor", amountCents: 5000, projectId: "p2", balanceAfterCents: 11000 }),
    row({ id: "d", entryDate: "2026-03-01", category: "material", direction: "reduce", amountCents: 3000, ebonyAbsorbsMaterial: true, projectId: "p1", balanceAfterCents: 11000 }),
  ];

  it("none: un solo grupo con todas las filas y su saldo intacto", () => {
    const g = groupLedgerRows(rows, "none");
    expect(g).toHaveLength(1);
    expect(g[0].rows.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(g[0].rows.at(-1)?.balanceAfterCents).toBe(11000);
  });

  it("category: orden fijo del catálogo; el material absorbido no suma a los totales", () => {
    const g = groupLedgerRows(rows, "category");
    expect(g.map((x) => x.key)).toEqual(["trabajo", "pago", "material"]);
    const trabajo = g.find((x) => x.key === "trabajo")!;
    expect(trabajo.aFavorCents).toBe(15000);
    expect(trabajo.reduceCents).toBe(0);
    const material = g.find((x) => x.key === "material")!;
    expect(material.reduceCents).toBe(0); // absorbido → no cuenta
  });

  it("project: primera aparición y 'sin proyecto' al final", () => {
    const g = groupLedgerRows(rows, "project");
    expect(g.map((x) => x.key)).toEqual(["p1", "p2", ""]);
    expect(g.find((x) => x.key === "p1")!.rows.map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("month: cronológico ascendente YYYY-MM", () => {
    const g = groupLedgerRows(rows, "month");
    expect(g.map((x) => x.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    const feb = g.find((x) => x.key === "2026-02")!;
    expect(feb.rows.map((r) => r.id)).toEqual(["b", "c"]);
    expect(feb.aFavorCents).toBe(5000);
    expect(feb.reduceCents).toBe(4000);
  });

  it("no reinicia el saldo corrido: cada fila conserva su balanceAfterCents", () => {
    const g = groupLedgerRows(rows, "month");
    const all = g.flatMap((x) => x.rows);
    expect(all.find((r) => r.id === "c")?.balanceAfterCents).toBe(11000);
  });
});

describe("ledgerRowsTotals", () => {
  it("suma a favor / reduce / neto, excluyendo el material que Ebony asume", () => {
    const t = ledgerRowsTotals([
      row({ direction: "a_favor", amountCents: 10000 }),
      row({ direction: "a_favor", amountCents: 5000 }),
      row({ direction: "reduce", amountCents: 4000 }),
      row({ direction: "reduce", amountCents: 3000, ebonyAbsorbsMaterial: true }), // no cuenta
    ]);
    expect(t.aFavorCents).toBe(15000);
    expect(t.reduceCents).toBe(4000);
    expect(t.netCents).toBe(11000);
  });

  it("conjunto vacío → todo en cero", () => {
    expect(ledgerRowsTotals([])).toEqual({ aFavorCents: 0, reduceCents: 0, netCents: 0 });
  });
});
