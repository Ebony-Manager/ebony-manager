/**
 * Capa de cálculos del estado de cuenta de Contratistas. PURA: no
 * importa `server-only` ni el cliente de Supabase, así corre en vitest
 * sin DB (igual que `src/lib/planilla/`). El servicio
 * (`src/services/contractors.ts`) hace los queries y le pasa arrays a
 * estas funciones.
 *
 * Regla del saldo (nunca se guarda):
 *   saldo = Σ amount_cents (a_favor)  −  Σ amount_cents (reduce)
 *   ... contando SOLO movimientos que mueven el saldo (los materiales que
 *   Ebony asume quedan fuera).
 *   saldo > 0 ⇒ Ebony le debe al contratista.
 */
import type {
  ContractorLedgerCategory,
  ContractorLedgerDirection,
  ContractorLedgerEntry,
  ContractorLedgerRow,
} from "@/types/contractors";

/** Orden fijo de las categorías para los selectores de la UI. */
export const CONTRACTOR_LEDGER_CATEGORIES: ContractorLedgerCategory[] = [
  "trabajo",
  "bono",
  "extra",
  "pago",
  "prestamo",
  "adelanto",
  "material",
  "gasto_operativo",
  "ajuste",
  "herramienta",
  "dano",
  "indrive",
  "otro",
];

/** Categorías cuya dirección es fija. `ajuste` NO está: ahí el usuario
 *  elige a mano si suma o resta. */
const FIXED_DIRECTION: Partial<Record<ContractorLedgerCategory, ContractorLedgerDirection>> = {
  trabajo: "a_favor",
  bono: "a_favor",
  extra: "a_favor",
  pago: "reduce",
  prestamo: "reduce",
  adelanto: "reduce",
  material: "reduce",
  gasto_operativo: "reduce",
  herramienta: "reduce",
  dano: "reduce",
  indrive: "reduce",
  otro: "reduce",
};

/** La dirección que fija la categoría, o `null` cuando la elige el
 *  usuario (solo "Ajuste"). La pantalla de registrar movimiento no
 *  muestra el control de dirección salvo que esto devuelva null. */
export function directionForCategory(
  category: ContractorLedgerCategory
): ContractorLedgerDirection | null {
  return FIXED_DIRECTION[category] ?? null;
}

/** Solo la categoría "material" admite el interruptor "Ebony asume". */
export function isMaterialCategory(category: ContractorLedgerCategory): boolean {
  return category === "material";
}

/** Monto de una línea en centavos enteros:
 *   - m² × costo/m² si vienen ambos (redondeo una sola vez), o
 *   - el monto fijo.
 *  Nunca negativo. */
export function lineAmountCents(input: {
  mt2: number | null;
  costPerMt2Cents: number | null;
  flatAmountCents: number;
}): number {
  if (input.mt2 != null && input.costPerMt2Cents != null) {
    return Math.max(0, Math.round(input.mt2 * input.costPerMt2Cents));
  }
  return Math.max(0, Math.round(input.flatAmountCents));
}

type BalanceInput = Pick<
  ContractorLedgerEntry,
  "direction" | "amountCents" | "ebonyAbsorbsMaterial"
>;

/** ¿Este movimiento mueve el saldo? No, si es un material que Ebony
 *  asume. */
export function movesBalance(e: Pick<ContractorLedgerEntry, "ebonyAbsorbsMaterial">): boolean {
  return !e.ebonyAbsorbsMaterial;
}

/** Efecto con signo en centavos: +amount si `a_favor`, −amount si
 *  `reduce`, 0 si no mueve el saldo. */
export function signedEffectCents(e: BalanceInput): number {
  if (!movesBalance(e)) return 0;
  return e.direction === "a_favor" ? e.amountCents : -e.amountCents;
}

/** Saldo total del contratista a partir de todos sus movimientos. */
export function contractorBalanceCents(entries: BalanceInput[]): number {
  return entries.reduce((sum, e) => sum + signedEffectCents(e), 0);
}

/**
 * Las filas del estado de cuenta con el saldo corrido. Se ordena por
 * `entryDate` ascendente; para fechas iguales conserva el orden de
 * entrada del array (el servicio ya lo trae por `created_at` asc), así
 * el desempate es estable y reproducible.
 */
export function withRunningBalance(entries: ContractorLedgerEntry[]): ContractorLedgerRow[] {
  const ordered = entries
    .map((e, index) => ({ e, index }))
    .sort((a, b) => {
      if (a.e.entryDate !== b.e.entryDate) return a.e.entryDate < b.e.entryDate ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ e }) => e);

  let running = 0;
  return ordered.map((e) => {
    running += signedEffectCents(e);
    return { ...e, balanceAfterCents: running };
  });
}
