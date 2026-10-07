/**
 * Definición de columnas para el toggle "Columnas" de Registro. Vive
 * fuera de registro-view.tsx para que planilla-client.tsx pueda ser
 * dueño del estado `visibleColumns` (y persistirlo) sin duplicar esta
 * lista — así la elección sobrevive a cambiar de tab y volver.
 *
 * Portado de Atlas. Cambio: `label` ahora es una entrada i18n `{es,en}`
 * en vez de un literal en español.
 */

import { strings } from "@/lib/i18n";
import type { PayrollCategoryKey } from "@/lib/planilla/payroll-colors";

export type FieldKey =
  | "basePayCents"
  | "extraHoursCents"
  | "extraDaysCents"
  | "bonusCents"
  | "diasLibresCents"
  | "horasDescontadasCents"
  | "diasDescontadosCents"
  | "otherDeductionCents"
  | "decimoPaidCents"
  | "vacationPaidCents"
  | "primaAntiguedadPaidCents";
export type ColumnKey = FieldKey | "paymentMethod" | "paid";

/** Las cuatro columnas que se entran como cantidad (horas/días) en vez
 *  de un monto en dólares — la rejilla las pinta con un input de
 *  cantidad + monto auto-calculado. Va indexado por el FieldKey `*Cents`
 *  (la identidad de la columna) y el valor es el campo de cantidad en
 *  PayrollEntry más su unidad. */
export const QUANTITY_FIELD_META: Partial<
  Record<
    FieldKey,
    { quantityField: "extraHours" | "extraDays" | "horasDescontadas" | "diasDescontados"; unit: "h" | "d" }
  >
> = {
  extraHoursCents: { quantityField: "extraHours", unit: "h" },
  extraDaysCents: { quantityField: "extraDays", unit: "d" },
  horasDescontadasCents: { quantityField: "horasDescontadas", unit: "h" },
  diasDescontadosCents: { quantityField: "diasDescontados", unit: "d" },
};

type Entry = { es: string; en: string };

/** Toda columna menos Empleado/Total es opcional. Secciones de color:
 *  Bonificaciones (verde) = horas extra, días extra, bonos, días libres
 *  (viáticos no tiene columna de captura en Registro); Descuentos (vino) =
 *  horas / días descontados y otros; Prestaciones (familia dorada) =
 *  Décimo, Vacación y Prima, cada una con su propio tono vecino.
 *  Método/Pagado no llevan categoría (van en la columna extrema nogal).
 *  Todas visibles por defecto. */
export const COLUMN_DEFS: { key: ColumnKey; label: Entry; category?: PayrollCategoryKey }[] = [
  { key: "basePayCents", label: strings.planilla.col_base, category: "salario" },
  { key: "extraHoursCents", label: strings.planilla.col_extra_hours, category: "bonos" },
  { key: "extraDaysCents", label: strings.planilla.col_extra_days, category: "bonos" },
  { key: "bonusCents", label: strings.planilla.col_bonos, category: "bonos" },
  { key: "diasLibresCents", label: strings.planilla.col_dias_libres, category: "bonos" },
  { key: "horasDescontadasCents", label: strings.planilla.col_horas_desc, category: "descuentos" },
  { key: "diasDescontadosCents", label: strings.planilla.col_dias_desc, category: "descuentos" },
  { key: "otherDeductionCents", label: strings.planilla.col_otros_desc, category: "descuentos" },
  { key: "decimoPaidCents", label: strings.planilla.col_decimo, category: "decimo" },
  { key: "vacationPaidCents", label: strings.planilla.col_vacacion, category: "vacacion" },
  { key: "primaAntiguedadPaidCents", label: strings.planilla.col_prima, category: "prima" },
  { key: "paymentMethod", label: strings.planilla.col_metodo },
  { key: "paid", label: strings.planilla.col_pagado },
];

export function defaultVisibleColumns(): Record<ColumnKey, boolean> {
  return Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>;
}

export const REGISTRO_COLUMNS_STORAGE_KEY = "ebony:planilla-registro-columns";
