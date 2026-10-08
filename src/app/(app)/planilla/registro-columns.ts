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
import type { PayrollCategoryKey, PayrollPalette } from "@/lib/planilla/payroll-colors";
import { pickBoolRecord, pickEnum } from "@/lib/planilla/saved-view";
import type { EmployeeCategoria } from "@/types/planilla";

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

/** Secciones del menú "Vista": esconden / muestran de un golpe un grupo de
 *  columnas (p. ej. Décimo + Vacación + Prima juntos). Las columnas sueltas
 *  (Base, Método, Pagado) se manejan una por una. */
export const COLUMN_SECTIONS: { key: string; label: Entry; columns: ColumnKey[] }[] = [
  {
    key: "bonificaciones",
    label: strings.planilla.col_bonificaciones,
    columns: ["extraHoursCents", "extraDaysCents", "bonusCents", "diasLibresCents"],
  },
  {
    key: "descuentos",
    label: strings.planilla.col_descuentos_simple,
    columns: ["horasDescontadasCents", "diasDescontadosCents", "otherDeductionCents"],
  },
  {
    key: "prestaciones",
    label: strings.planilla.col_prestaciones_simple,
    columns: ["decimoPaidCents", "vacationPaidCents", "primaAntiguedadPaidCents"],
  },
];

// ── "Mi vista" de Registro ──────────────────────────────────────────────

export type RegistroViewMode = "expanded" | "simple";
export type CategoriaFilter = EmployeeCategoria | "todos";

/** Lo que guarda "Guardar como mi vista" en Registro. */
export interface RegistroSavedView {
  visibleColumns: Record<ColumnKey, boolean>;
  view: RegistroViewMode;
  palette: PayrollPalette;
  categoria: CategoriaFilter;
}

/** La vista original (la de fábrica): Expandida, a todo color, todas las
 *  columnas, todos los empleados. */
export function defaultRegistroView(): RegistroSavedView {
  return { visibleColumns: defaultVisibleColumns(), view: "expanded", palette: "full", categoria: "todos" };
}

export function sanitizeRegistroView(o: Record<string, unknown>): RegistroSavedView {
  const d = defaultRegistroView();
  return {
    visibleColumns: pickBoolRecord(o.visibleColumns, d.visibleColumns),
    view: pickEnum(o.view, ["expanded", "simple"] as const, d.view),
    palette: pickEnum(o.palette, ["full", "sober"] as const, d.palette),
    categoria: pickEnum(o.categoria, ["todos", "taller", "administrativo"] as const, d.categoria),
  };
}
