import type { LedgerCategory } from "@/types/planilla";

/** Clave i18n de `strings.planilla` para cada categoría de ledger.
 *  Compartido por ledger-section y ledger-entry-dialog. */
export const LEDGER_CATEGORY_LABEL_KEY: Record<LedgerCategory, string> = {
  prestamo: "ledger_cat_prestamo",
  adelanto: "ledger_cat_adelanto",
  herramienta: "ledger_cat_herramienta",
  dano: "ledger_cat_dano",
  seguro_social: "ledger_cat_seguro_social",
  carnet: "ledger_cat_carnet",
  otro: "ledger_cat_otro",
  indrive: "ledger_cat_indrive",
};

/** Categorías que ofrece el diálogo genérico "Agregar movimiento" —
 *  préstamo/adelanto quedan fuera a propósito: van por LoanDialog, que
 *  arma su calendario de cuotas. */
export const GENERIC_LEDGER_CATEGORIES: LedgerCategory[] = ["herramienta", "dano", "seguro_social", "carnet", "otro"];
