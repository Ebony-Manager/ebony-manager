import type { LedgerCategory } from "@/types/planilla";

/** Clave i18n de `strings.planilla` para cada categoría de ledger.
 *  Compartido por las listas de préstamos y descuentos. */
export const LEDGER_CATEGORY_LABEL_KEY: Record<LedgerCategory, string> = {
  prestamo: "ledger_cat_prestamo",
  adelanto: "ledger_cat_adelanto",
  herramienta: "ledger_cat_herramienta",
  dano: "ledger_cat_dano",
  seguro_social: "ledger_cat_seguro_social",
  carnet: "ledger_cat_carnet",
  otro: "ledger_cat_otro",
  indrive: "ledger_cat_indrive",
  interes: "ledger_cat_interes",
  tercero: "ledger_cat_tercero",
};
