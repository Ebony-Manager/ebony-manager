import type { ContractorLedgerCategory } from "@/types/contractors";

/** Clave i18n de `strings.contratistas` para cada categoría del estado
 *  de cuenta. Compartido por el directorio, la ficha y el diálogo. */
export const CONTRACTOR_CATEGORY_LABEL_KEY: Record<ContractorLedgerCategory, string> = {
  trabajo: "cat_trabajo",
  bono: "cat_bono",
  extra: "cat_extra",
  pago: "cat_pago",
  prestamo: "cat_prestamo",
  adelanto: "cat_adelanto",
  material: "cat_material",
  gasto_operativo: "cat_gasto_operativo",
  ajuste: "cat_ajuste",
};
