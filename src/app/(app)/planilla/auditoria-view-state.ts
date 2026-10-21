/**
 * Estado "de vista" de Auditoría (lo que guarda "Guardar como mi vista") y
 * sus valores de fábrica. Vive aparte de auditoria-view.tsx para que
 * pagos-client pueda leer el tipo de empleado guardado sin importar
 * toda la pantalla.
 */
import type { PayrollPalette } from "@/lib/planilla/payroll-colors";
import { pickBool, pickBoolRecord, pickEnum } from "@/lib/planilla/saved-view";
import type { CategoriaFilter } from "./registro-columns";

export type Densidad = "comprimida" | "expandida";
export type NivelDetalle = "macro" | "quincenal" | "concepto" | "micro";
export type StatusFilter = "todos" | "activo" | "inactivo";

export const GROUP_KEYS = [
  "salarios",
  "prestaciones",
  "bonificaciones",
  "descuentos",
  "prestamos_otros",
  "descuento_prestamos",
] as const;

export interface AuditoriaSavedView {
  palette: PayrollPalette;
  nivel: NivelDetalle;
  densidad: Densidad;
  visibleGroups: Record<string, boolean>;
  showPrestacionesPreview: boolean;
  showBaseComparison: boolean;
  /** Mostrar la columna "Total del año". */
  showYearTotal: boolean;
  statusFilter: StatusFilter;
  categoria: CategoriaFilter;
}

export function defaultAuditoriaView(): AuditoriaSavedView {
  return {
    palette: "full",
    nivel: "concepto",
    densidad: "comprimida",
    visibleGroups: Object.fromEntries(GROUP_KEYS.map((k) => [k, true])),
    showPrestacionesPreview: true,
    showBaseComparison: true,
    showYearTotal: true,
    statusFilter: "todos",
    categoria: "todos",
  };
}

export function sanitizeAuditoriaView(o: Record<string, unknown>): AuditoriaSavedView {
  const d = defaultAuditoriaView();
  return {
    palette: pickEnum(o.palette, ["full", "sober"] as const, d.palette),
    nivel: pickEnum(o.nivel, ["macro", "quincenal", "concepto", "micro"] as const, d.nivel),
    densidad: pickEnum(o.densidad, ["comprimida", "expandida"] as const, d.densidad),
    visibleGroups: pickBoolRecord(o.visibleGroups, d.visibleGroups as Record<string, boolean>),
    showPrestacionesPreview: pickBool(o.showPrestacionesPreview, d.showPrestacionesPreview),
    showBaseComparison: pickBool(o.showBaseComparison, d.showBaseComparison),
    showYearTotal: pickBool(o.showYearTotal, d.showYearTotal),
    statusFilter: pickEnum(o.statusFilter, ["todos", "activo", "inactivo"] as const, d.statusFilter),
    categoria: pickEnum(o.categoria, ["todos", "taller", "administrativo"] as const, d.categoria),
  };
}
