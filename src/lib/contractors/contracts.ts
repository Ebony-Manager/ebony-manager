/**
 * Contratos de contratistas — cálculos PUROS (sin Supabase), como el resto
 * de `src/lib/contractors/`.
 *
 *  · El VALOR de un contrato son los movimientos con `contractId`.
 *  · Una FUENTE es lo que baja el saldo fuera de un contrato (pago, cuota
 *    de préstamo, adelanto, material…); un CRÉDITO SUELTO es lo acreditado
 *    fuera de un contrato (la historia vieja, un bono…).
 *  · Los abonos (`ContractorAllocation`) reparten fuentes entre contratos y
 *    créditos sueltos. Lo que una fuente no tiene repartido está "a cuenta"
 *    y se aplica primero en el próximo pago.
 *
 * Siempre cuadra: saldo = Σ falta de contratos + Σ falta de créditos
 * sueltos − Σ a cuenta. El reparto de verdad lo hace la función
 * `register_contractor_payment` de la base; acá solo se previsualiza.
 */
import type { ContractorAllocation, ContractorContract, ContractorLedgerEntry } from "@/types/contractors";
import { movesBalance } from "./contractor-ledger";
import { formatCents } from "@/lib/planilla/payroll-period";

type EntryLike = Pick<
  ContractorLedgerEntry,
  "id" | "direction" | "contractId" | "ebonyAbsorbsMaterial" | "amountCents" | "entryDate"
>;

/** Lo que le falta por abonar al contrato (negativo = se abonó de más). */
export function contractPendingCents(c: Pick<ContractorContract, "valueCents" | "allocatedCents">): number {
  return c.valueCents - c.allocatedCents;
}

/** Lo que se le puede abonar hoy al contrato: lo pendiente menos lo
 *  retenido (retención de garantía, hasta que el proyecto esté terminado). */
export function contractPayableCents(
  c: Pick<ContractorContract, "valueCents" | "allocatedCents" | "retentionCents">
): number {
  return Math.max(0, contractPendingCents(c) - c.retentionCents);
}

/** Subtítulo de un contrato en las listas de pago: su proyecto (si se
 *  llama distinto) y lo retenido, si tiene. */
export function contractSublabel(
  c: Pick<ContractorContract, "name" | "projectName" | "retentionCents">,
  retainedLabel: string
): string | undefined {
  const parts = [
    c.projectName !== c.name ? c.projectName : null,
    c.retentionCents > 0 ? `${retainedLabel}: ${formatCents(c.retentionCents)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** Regla de retención de garantía de un tipo de contratista. */
export interface RetentionRule {
  pct: number;
  /** Trabajos con fecha anterior no llevan retención. */
  startsOn: string | null;
}

/**
 * Lo retenido de un contrato: el % de cada trabajo / extra a favor
 * (redondeado hacia arriba al centavo, a favor de la empresa) mientras su
 * proyecto no esté terminado. Igual que `contractor_contract_retention_cents`
 * de la base, que es la que manda al pagar.
 */
export function contractRetentionCents(
  entries: readonly Pick<ContractorLedgerEntry, "category" | "direction" | "amountCents" | "entryDate" | "ebonyAbsorbsMaterial">[],
  rule: RetentionRule | null,
  delivered: boolean
): number {
  if (delivered || !rule || rule.pct <= 0) return 0;
  let total = 0;
  for (const e of entries) {
    if (e.direction !== "a_favor" || e.ebonyAbsorbsMaterial) continue;
    if (e.category !== "trabajo" && e.category !== "extra") continue;
    if (rule.startsOn && e.entryDate < rule.startsOn) continue;
    total += Math.ceil((e.amountCents * rule.pct) / 100);
  }
  return total;
}

/** Avance de pago en %, entre 0 y 100. */
export function contractProgressPct(c: Pick<ContractorContract, "valueCents" | "allocatedCents">): number {
  if (c.valueCents <= 0) return c.allocatedCents > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((c.allocatedCents / c.valueCents) * 100)));
}

/** ¿Este movimiento baja el saldo fuera de un contrato? (se puede repartir) */
export function isSource(e: Pick<EntryLike, "direction" | "contractId" | "ebonyAbsorbsMaterial">): boolean {
  return e.direction === "reduce" && e.contractId === null && movesBalance(e);
}

/** ¿Este movimiento es lo acreditado fuera de un contrato? */
export function isLooseCredit(e: Pick<EntryLike, "direction" | "contractId" | "ebonyAbsorbsMaterial">): boolean {
  return e.direction === "a_favor" && e.contractId === null && movesBalance(e);
}

function sumBy<K extends "sourceEntryId" | "creditEntryId">(allocations: readonly ContractorAllocation[], key: K) {
  const out = new Map<string, number>();
  for (const a of allocations) {
    const id = a[key];
    if (id) out.set(id, (out.get(id) ?? 0) + a.amountCents);
  }
  return out;
}

export interface Remaining<E> {
  entry: E;
  remainingCents: number;
}

/** Lo que está "a cuenta": fuentes con fecha hasta `until` y algo sin
 *  repartir, en el orden en que vienen (cronológico). */
export function unallocatedSources<E extends EntryLike>(
  entries: readonly E[],
  allocations: readonly ContractorAllocation[],
  until: string
): Remaining<E>[] {
  const used = sumBy(allocations, "sourceEntryId");
  return entries
    .filter((e) => isSource(e) && e.entryDate <= until)
    .map((entry) => ({ entry, remainingCents: entry.amountCents - (used.get(entry.id) ?? 0) }))
    .filter((r) => r.remainingCents > 0);
}

/** Lo acreditado sin contrato que todavía no se le ha abonado. */
export function looseCredits<E extends EntryLike>(
  entries: readonly E[],
  allocations: readonly ContractorAllocation[]
): Remaining<E>[] {
  const used = sumBy(allocations, "creditEntryId");
  return entries
    .filter(isLooseCredit)
    .map((entry) => ({ entry, remainingCents: entry.amountCents - (used.get(entry.id) ?? 0) }))
    .filter((r) => r.remainingCents > 0);
}

/** Cuánto de un pago sale de lo que está a cuenta y cuánto en efectivo. */
export function paymentPreview(abonosCents: number, onAccountCents: number): { deductedCents: number; cashCents: number } {
  const total = Math.max(0, abonosCents);
  const deductedCents = Math.min(Math.max(0, onAccountCents), total);
  return { deductedCents, cashCents: total - deductedCents };
}

/** Contratos con lo activo primero y, dentro, del más nuevo al más viejo. */
export function sortContracts<C extends Pick<ContractorContract, "status" | "contractDate" | "name">>(list: readonly C[]): C[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
    if (a.contractDate !== b.contractDate) return a.contractDate < b.contractDate ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
