import { describe, expect, it } from "vitest";

import type { ContractorAllocation } from "@/types/contractors";
import {
  contractPayableCents,
  contractPendingCents,
  contractRetentionCents,
  contractProgressPct,
  isLooseCredit,
  isSource,
  looseCredits,
  paymentPreview,
  sortContracts,
  unallocatedSources,
} from "./contracts";

const entry = (
  id: string,
  direction: "a_favor" | "reduce",
  amountCents: number,
  entryDate: string,
  extra: { contractId?: string | null; ebonyAbsorbsMaterial?: boolean } = {}
) => ({
  id,
  direction,
  amountCents,
  entryDate,
  contractId: extra.contractId ?? null,
  ebonyAbsorbsMaterial: extra.ebonyAbsorbsMaterial ?? false,
});

const alloc = (sourceEntryId: string, amountCents: number, target: { contractId?: string; creditEntryId?: string }): ContractorAllocation => ({
  id: `${sourceEntryId}-${target.contractId ?? target.creditEntryId}`,
  sourceEntryId,
  contractId: target.contractId ?? null,
  creditEntryId: target.creditEntryId ?? null,
  amountCents,
});

describe("contratos", () => {
  it("lo que falta y el avance", () => {
    expect(contractPendingCents({ valueCents: 500000, allocatedCents: 150000 })).toBe(350000);
    expect(contractProgressPct({ valueCents: 500000, allocatedCents: 150000 })).toBe(30);
    expect(contractProgressPct({ valueCents: 500000, allocatedCents: 600000 })).toBe(100);
    expect(contractProgressPct({ valueCents: 0, allocatedCents: 0 })).toBe(0);
  });

  it("fuente = baja el saldo fuera de un contrato; crédito suelto = a favor fuera de un contrato", () => {
    expect(isSource(entry("p", "reduce", 100, "2026-10-01"))).toBe(true);
    expect(isSource(entry("t", "reduce", 100, "2026-10-01", { contractId: "k" }))).toBe(false);
    expect(isSource(entry("m", "reduce", 100, "2026-10-01", { ebonyAbsorbsMaterial: true }))).toBe(false);
    expect(isLooseCredit(entry("b", "a_favor", 100, "2026-10-01"))).toBe(true);
    expect(isLooseCredit(entry("w", "a_favor", 100, "2026-10-01", { contractId: "k" }))).toBe(false);
  });

  it("a cuenta: lo no repartido hasta la fecha, en orden", () => {
    const entries = [
      entry("adelanto", "reduce", 30000, "2026-10-08"),
      entry("pago", "reduce", 50000, "2026-10-15"),
      entry("cuota-futura", "reduce", 10000, "2026-11-15"),
      entry("trabajo", "a_favor", 500000, "2026-10-01", { contractId: "k" }),
    ];
    const allocations = [alloc("pago", 50000, { contractId: "k" }), alloc("adelanto", 10000, { contractId: "k" })];
    const rows = unallocatedSources(entries, allocations, "2026-10-30");
    expect(rows.map((r) => [r.entry.id, r.remainingCents])).toEqual([["adelanto", 20000]]);
  });

  it("créditos sueltos con lo que falta", () => {
    const entries = [entry("bono", "a_favor", 20000, "2026-09-01"), entry("viejo", "a_favor", 10000, "2026-08-01")];
    const rows = looseCredits(entries, [alloc("pago", 20000, { creditEntryId: "bono" })]);
    expect(rows.map((r) => [r.entry.id, r.remainingCents])).toEqual([["viejo", 10000]]);
  });

  it("el pago usa primero lo que está a cuenta", () => {
    // Abono $1,500 con un adelanto de $300 por descontar → $1,200 en efectivo.
    expect(paymentPreview(150000, 30000)).toEqual({ deductedCents: 30000, cashCents: 120000 });
    // Si lo que está a cuenta alcanza, no sale efectivo.
    expect(paymentPreview(20000, 30000)).toEqual({ deductedCents: 20000, cashCents: 0 });
  });

  it("orden: activos primero, luego del más nuevo al más viejo", () => {
    const list = [
      { status: "COMPLETED" as const, contractDate: "2026-09-01", name: "B" },
      { status: "ACTIVE" as const, contractDate: "2026-01-01", name: "A" },
      { status: "ACTIVE" as const, contractDate: "2026-05-01", name: "C" },
    ];
    expect(sortContracts(list).map((c) => c.name)).toEqual(["C", "A", "B"]);
  });
});

describe("retención de garantía", () => {
  const work = (amountCents: number, entryDate = "2026-10-20", category: "trabajo" | "extra" | "bono" = "trabajo") => ({
    category,
    direction: "a_favor" as const,
    amountCents,
    entryDate,
    ebonyAbsorbsMaterial: false,
  });
  const rule = { pct: 10, startsOn: "2026-10-14" };

  it("retiene el % del trabajo y extra desde la fecha de inicio, redondeando hacia arriba", () => {
    expect(contractRetentionCents([work(389553), work(10000, "2026-10-21", "extra")], rule, false)).toBe(38956 + 1000);
    expect(contractRetentionCents([work(100000, "2026-10-13")], rule, false)).toBe(0);
    expect(contractRetentionCents([work(100000, "2026-10-20", "bono")], rule, false)).toBe(0);
  });

  it("no retiene con el proyecto terminado ni sin regla", () => {
    expect(contractRetentionCents([work(100000)], rule, true)).toBe(0);
    expect(contractRetentionCents([work(100000)], null, false)).toBe(0);
  });

  it("lo que se puede pagar es lo pendiente menos lo retenido", () => {
    expect(contractPayableCents({ valueCents: 100000, allocatedCents: 0, retentionCents: 10000 })).toBe(90000);
    expect(contractPayableCents({ valueCents: 100000, allocatedCents: 95000, retentionCents: 10000 })).toBe(0);
  });
});
