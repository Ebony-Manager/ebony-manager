import { describe, expect, it } from "vitest";

import type { ContractorLedgerEntry } from "@/types/contractors";
import {
  contractorBalanceCents,
  directionForCategory,
  isMaterialCategory,
  lineAmountCents,
  signedEffectCents,
  withRunningBalance,
} from "@/lib/contractors/contractor-ledger";

function entry(over: Partial<ContractorLedgerEntry>): ContractorLedgerEntry {
  return {
    id: over.id ?? "x",
    contractorId: "c1",
    projectId: null,
    entryDate: over.entryDate ?? "2026-01-01",
    category: over.category ?? "trabajo",
    direction: over.direction ?? "a_favor",
    mt2: over.mt2 ?? null,
    costPerMt2Cents: over.costPerMt2Cents ?? null,
    amountCents: over.amountCents ?? 0,
    ebonyAbsorbsMaterial: over.ebonyAbsorbsMaterial ?? false,
    clientText: null,
    description: null,
    notes: null,
    ...over,
  };
}

describe("directionForCategory", () => {
  it("fija a_favor para trabajo/bono/extra", () => {
    expect(directionForCategory("trabajo")).toBe("a_favor");
    expect(directionForCategory("bono")).toBe("a_favor");
    expect(directionForCategory("extra")).toBe("a_favor");
  });
  it("fija reduce para pago/prestamo/adelanto/material/gasto_operativo", () => {
    for (const c of ["pago", "prestamo", "adelanto", "material", "gasto_operativo"] as const) {
      expect(directionForCategory(c)).toBe("reduce");
    }
  });
  it("deja ajuste sin dirección (la elige el usuario)", () => {
    expect(directionForCategory("ajuste")).toBeNull();
  });
});

describe("isMaterialCategory", () => {
  it("solo material admite el interruptor de Ebony asume", () => {
    expect(isMaterialCategory("material")).toBe(true);
    expect(isMaterialCategory("trabajo")).toBe(false);
    expect(isMaterialCategory("ajuste")).toBe(false);
  });
});

describe("lineAmountCents", () => {
  it("multiplica m² × costo/m² y redondea una vez", () => {
    expect(lineAmountCents({ mt2: 3.5, costPerMt2Cents: 4500, flatAmountCents: 0 })).toBe(15750);
    expect(lineAmountCents({ mt2: 2.33, costPerMt2Cents: 4567, flatAmountCents: 0 })).toBe(Math.round(2.33 * 4567));
  });
  it("usa el monto fijo cuando no hay m²/costo", () => {
    expect(lineAmountCents({ mt2: null, costPerMt2Cents: null, flatAmountCents: 12345 })).toBe(12345);
    expect(lineAmountCents({ mt2: 5, costPerMt2Cents: null, flatAmountCents: 999 })).toBe(999);
  });
  it("nunca es negativo", () => {
    expect(lineAmountCents({ mt2: -1, costPerMt2Cents: 100, flatAmountCents: 0 })).toBe(0);
    expect(lineAmountCents({ mt2: null, costPerMt2Cents: null, flatAmountCents: -50 })).toBe(0);
  });
});

describe("signedEffectCents / contractorBalanceCents", () => {
  it("a_favor suma, reduce resta", () => {
    expect(signedEffectCents(entry({ direction: "a_favor", amountCents: 5000 }))).toBe(5000);
    expect(signedEffectCents(entry({ direction: "reduce", amountCents: 5000 }))).toBe(-5000);
  });
  it("un material que Ebony asume no mueve el saldo", () => {
    expect(
      signedEffectCents(
        entry({ category: "material", direction: "reduce", amountCents: 8000, ebonyAbsorbsMaterial: true })
      )
    ).toBe(0);
  });
  it("suma todos los movimientos", () => {
    const entries = [
      entry({ direction: "a_favor", amountCents: 100_00 }), // trabajo
      entry({ category: "adelanto", direction: "reduce", amountCents: 30_00 }),
      entry({ category: "material", direction: "reduce", amountCents: 20_00 }),
      entry({ category: "material", direction: "reduce", amountCents: 7_00, ebonyAbsorbsMaterial: true }),
    ];
    expect(contractorBalanceCents(entries)).toBe(100_00 - 30_00 - 20_00);
  });
  it("saldo negativo cuando el contratista debe a Ebony", () => {
    expect(
      contractorBalanceCents([
        entry({ direction: "a_favor", amountCents: 10_00 }),
        entry({ category: "prestamo", direction: "reduce", amountCents: 40_00 }),
      ])
    ).toBe(-30_00);
  });
});

describe("withRunningBalance", () => {
  it("acumula el saldo en orden cronológico, estable para fechas iguales", () => {
    const rows = withRunningBalance([
      entry({ id: "a", entryDate: "2026-03-10", direction: "a_favor", amountCents: 500_00 }),
      entry({ id: "b", entryDate: "2026-03-10", category: "pago", direction: "reduce", amountCents: 200_00 }),
      entry({ id: "c", entryDate: "2026-02-01", direction: "a_favor", amountCents: 100_00 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(rows.map((r) => r.balanceAfterCents)).toEqual([100_00, 600_00, 400_00]);
  });
  it("un material asumido no cambia el saldo corrido", () => {
    const rows = withRunningBalance([
      entry({ id: "a", entryDate: "2026-01-01", direction: "a_favor", amountCents: 300_00 }),
      entry({
        id: "b",
        entryDate: "2026-01-02",
        category: "material",
        direction: "reduce",
        amountCents: 50_00,
        ebonyAbsorbsMaterial: true,
      }),
      entry({ id: "c", entryDate: "2026-01-03", category: "pago", direction: "reduce", amountCents: 100_00 }),
    ]);
    expect(rows.map((r) => r.balanceAfterCents)).toEqual([300_00, 300_00, 200_00]);
  });
});
