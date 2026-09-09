/**
 * Agrupación de las filas del estado de cuenta de Contratistas. PURO
 * (sin `server-only`, sin Supabase) — corre en vitest.
 *
 * REGLA CLAVE DEL SALDO: agrupar (igual que filtrar por período) SOLO
 * reordena/particiona las filas que se muestran. El `balanceAfterCents`
 * de cada fila ya viene calculado sobre la historia COMPLETA
 * (`withRunningBalance`) y no se toca — el saldo corrido nunca se
 * reinicia por grupo. Los totales por grupo que devuelve esta capa son
 * sumas de "a favor" / "reduce" del grupo, NO un saldo.
 */
import type { ContractorLedgerCategory, ContractorLedgerRow } from "@/types/contractors";
import { CONTRACTOR_LEDGER_CATEGORIES } from "@/lib/contractors/contractor-ledger";

export type LedgerGroupBy = "none" | "category" | "project" | "month";

export const LEDGER_GROUP_BYS: readonly LedgerGroupBy[] = [
  "none",
  "category",
  "project",
  "month",
] as const;

export interface LedgerGroup {
  /** Clave cruda del grupo: "" (sin agrupar), la categoría, el
   *  `projectId` ("" = sin proyecto), o "YYYY-MM". La UI resuelve la
   *  etiqueta visible. */
  key: string;
  rows: ContractorLedgerRow[];
  /** Suma de montos con dirección a_favor del grupo (que mueven saldo). */
  aFavorCents: number;
  /** Suma de montos con dirección reduce del grupo (que mueven saldo). */
  reduceCents: number;
}

function totals(rows: ContractorLedgerRow[]): { aFavorCents: number; reduceCents: number } {
  let aFavorCents = 0;
  let reduceCents = 0;
  for (const r of rows) {
    if (r.ebonyAbsorbsMaterial) continue; // no mueve el saldo
    if (r.direction === "a_favor") aFavorCents += r.amountCents;
    else reduceCents += r.amountCents;
  }
  return { aFavorCents, reduceCents };
}

const CATEGORY_ORDER = new Map<ContractorLedgerCategory, number>(
  CONTRACTOR_LEDGER_CATEGORIES.map((c, i) => [c, i])
);

/**
 * Parte `rows` en grupos según `groupBy`. El orden DENTRO de cada grupo
 * se conserva tal cual viene (cronológico, con el saldo corrido ya
 * calculado). El orden ENTRE grupos:
 *   - none     → un solo grupo
 *   - category → orden fijo del catálogo de categorías
 *   - project  → primera aparición; "sin proyecto" (key "") al final
 *   - month    → cronológico ascendente por "YYYY-MM"
 */
export function groupLedgerRows(
  rows: ContractorLedgerRow[],
  groupBy: LedgerGroupBy
): LedgerGroup[] {
  if (groupBy === "none") {
    return [{ key: "", rows, ...totals(rows) }];
  }

  const keyOf = (r: ContractorLedgerRow): string => {
    if (groupBy === "category") return r.category;
    if (groupBy === "project") return r.projectId ?? "";
    return r.entryDate.slice(0, 7); // YYYY-MM
  };

  const buckets = new Map<string, ContractorLedgerRow[]>();
  const firstSeen: string[] = [];
  for (const r of rows) {
    const k = keyOf(r);
    let list = buckets.get(k);
    if (!list) {
      list = [];
      buckets.set(k, list);
      firstSeen.push(k);
    }
    list.push(r);
  }

  let orderedKeys: string[];
  if (groupBy === "category") {
    orderedKeys = [...buckets.keys()].sort(
      (a, b) =>
        (CATEGORY_ORDER.get(a as ContractorLedgerCategory) ?? 99) -
        (CATEGORY_ORDER.get(b as ContractorLedgerCategory) ?? 99)
    );
  } else if (groupBy === "month") {
    orderedKeys = [...buckets.keys()].sort();
  } else {
    // project: primera aparición, con "sin proyecto" ("") al final
    orderedKeys = firstSeen.filter((k) => k !== "");
    if (buckets.has("")) orderedKeys.push("");
  }

  return orderedKeys.map((key) => {
    const groupRows = buckets.get(key)!;
    return { key, rows: groupRows, ...totals(groupRows) };
  });
}
