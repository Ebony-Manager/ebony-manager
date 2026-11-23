import { REQUIRED_ORDER_FILES, type OrderFileKind } from "@/types/produccion";

/** Lo que bloquea enviar la orden a revisión. */
export type MissingKey = "items" | OrderFileKind | "mano_obra";

/**
 * Lo que le falta a una orden para enviarse: al menos un ítem, los 4 documentos y la hoja de mano de obra.
 * El color por definir no bloquea (se exige más adelante, al autorizar la pintura): se cuenta aparte.
 */
export function orderMissing(o: { itemCount: number; fileKinds: readonly OrderFileKind[]; laborCount: number }): MissingKey[] {
  const out: MissingKey[] = [];
  if (o.itemCount === 0) out.push("items");
  const have = new Set(o.fileKinds);
  for (const k of REQUIRED_ORDER_FILES) if (!have.has(k)) out.push(k);
  if (o.laborCount === 0) out.push("mano_obra");
  return out;
}

/** Monto de una línea de mano de obra, en centavos (cantidad × tarifa, redondeado). */
export function laborAmountCents(l: { quantity: number; unitPriceCents: number }): number {
  return Math.round(l.quantity * l.unitPriceCents);
}

/** Total de la mano de obra por tipo de contratista (ebanista, pintor…), en centavos. */
export function laborTotals(lines: readonly { contractorType: string; quantity: number; unitPriceCents: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) out.set(l.contractorType, (out.get(l.contractorType) ?? 0) + laborAmountCents(l));
  return out;
}
