/**
 * Cálculo de la Quincena de contratistas (Personal → Pagos → Contratistas →
 * Cierre), puro: por cada contratista, lo que se le puede abonar a cada
 * contrato, lo acreditado sin contrato, lo que está a cuenta hasta el día de
 * pago y — con los abonos del borrador — cuánto se descuenta y cuánto se
 * entrega en efectivo. Lo usan la pantalla (con lo que se escribe en las
 * casillas) y el MCP (con lo guardado en el borrador), así cuentan igual.
 */
import type { ContractorAllocation, ContractorContract } from "@/types/contractors";
import { contractPayableCents, looseCredits, paymentPreview, sortContracts, unallocatedSources, type Remaining } from "./contracts";
import type { ContractorLedgerEntry } from "@/types/contractors";

type ClosingEntryLike = Pick<
  ContractorLedgerEntry,
  "id" | "contractorId" | "entryDate" | "direction" | "amountCents" | "contractId" | "ebonyAbsorbsMaterial"
>;

export interface ClosingInput<E extends ClosingEntryLike> {
  payDate: string;
  /** Abonos del borrador guardado. */
  lines: { contractorId: string; contractId: string | null; amountCents: number }[];
  results: { contractorId: string; abonosCents: number; deductedCents: number; cashCents: number }[];
  contractors: { id: string; name: string; status: "ACTIVE" | "INACTIVE"; photoPath: string | null }[];
  contracts: ContractorContract[];
  entries: E[];
  allocations: (ContractorAllocation & { contractorId: string })[];
}

export interface ClosingRow<E> {
  id: string;
  name: string;
  photoPath: string | null;
  /** Contratos con algo por pagar hoy (o con un abono en el borrador). */
  contracts: { contract: ContractorContract; pending: number }[];
  /** Lo acreditado sin contrato que falta abonarle. */
  loosePending: number;
  /** Lo que está a cuenta hasta el día de pago (se descuenta primero). */
  onAccount: Remaining<E>[];
  onAccountCents: number;
  abonosCents: number;
  deductedCents: number;
  cashCents: number;
  /** Algún abono pasa de lo que se le puede pagar a ese contrato (o a lo sin contrato). */
  over: boolean;
  /** Con la quincena pagada: lo que quedó registrado. */
  paid: { abonosCents: number; deductedCents: number; cashCents: number } | null;
}

/**
 * Las filas de la quincena. `amountFor` da el abono de cada línea (la
 * pantalla lo saca de lo que se está escribiendo; por defecto, el borrador
 * guardado). Con la quincena pagada solo salen quienes cobraron.
 */
export function closingRows<E extends ClosingEntryLike>(
  data: ClosingInput<E>,
  paid: boolean,
  amountFor: (contractorId: string, contractId: string | null) => number = (cid, kid) =>
    data.lines.find((l) => l.contractorId === cid && l.contractId === kid)?.amountCents ?? 0
): ClosingRow<E>[] {
  const byContractor = <T extends { contractorId: string }>(list: T[], id: string) => list.filter((x) => x.contractorId === id);
  const out: ClosingRow<E>[] = [];
  for (const c of data.contractors) {
    const entries = byContractor(data.entries, c.id);
    const allocations = byContractor(data.allocations, c.id);
    const lineContracts = new Set(data.lines.filter((l) => l.contractorId === c.id).map((l) => l.contractId));
    const contracts = sortContracts(data.contracts.filter((k) => k.contractorId === c.id))
      .map((contract) => ({ contract, pending: contractPayableCents(contract) }))
      .filter(({ contract, pending }) => pending > 0 || lineContracts.has(contract.id));
    const loosePending = looseCredits(entries, allocations).reduce((s, r) => s + r.remainingCents, 0);
    const onAccount = unallocatedSources(entries, allocations, data.payDate);
    const onAccountCents = onAccount.reduce((s, r) => s + r.remainingCents, 0);
    const result = data.results.find((r) => r.contractorId === c.id) ?? null;
    const hasLines = lineContracts.size > 0;
    if (paid ? !result : c.status !== "ACTIVE" && !hasLines) continue;
    // Sin contratos por pagar, solo entra si lo acreditado sin contrato supera lo que debe (lo que está a cuenta):
    // un «abono a deuda» de alguien que todavía debe no es algo que haya que pagarle (saldos viejos de la migración).
    if (!paid && contracts.length === 0 && loosePending <= onAccountCents && !hasLines) continue;

    const amount = (contractId: string | null) => amountFor(c.id, contractId);
    const abonosCents = contracts.reduce((s, x) => s + amount(x.contract.id), 0) + amount(null);
    const over = contracts.some((x) => amount(x.contract.id) > x.pending) || amount(null) > loosePending;
    const preview = paymentPreview(abonosCents, onAccountCents);
    out.push({
      id: c.id,
      name: c.name,
      photoPath: c.photoPath,
      contracts,
      loosePending,
      onAccount,
      onAccountCents,
      abonosCents,
      deductedCents: preview.deductedCents,
      cashCents: preview.cashCents,
      over,
      paid: result,
    });
  }
  return out;
}

/** Totales de la quincena (lo pagado si ya está pagada; si no, el borrador). */
export function closingTotals(rows: readonly ClosingRow<unknown>[]): { abonos: number; deducted: number; cash: number } {
  return rows.reduce(
    (s, r) => {
      const src = r.paid ?? r;
      return { abonos: s.abonos + src.abonosCents, deducted: s.deducted + src.deductedCents, cash: s.cash + src.cashCents };
    },
    { abonos: 0, deducted: 0, cash: 0 }
  );
}
