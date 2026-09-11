/**
 * Sistema de color semántico del módulo Planilla, adaptado del
 * `payroll-colors.ts` de Atlas a los tokens de Ebony.
 *
 * Atlas apoyaba las categorías en su escala `--chart-N`; Ebony no la
 * tiene, así que cada categoría lee un token `--payroll-*` definido en
 * `globals.css`, todos re-mapeados a la paleta de marca de Ebony
 * (madera, dorado, verde bosque, rojo). Ningún color literal vive acá:
 * este archivo solo devuelve strings `var(--…)` para usar en estilos
 * inline. Registro, y más adelante Resumen/Auditoría/Dashboard, importan
 * de acá para que una categoría nunca cambie de color entre vistas.
 */

export type PayrollCategoryKey =
  | "salario"
  | "bonos"
  | "decimo"
  | "vacacion"
  | "prima"
  | "descuentos"
  | "descuentoPrestamos"
  | "prestamos"
  | "total";

export const PAYROLL_CATEGORY: Record<PayrollCategoryKey, { color: string }> = {
  salario: { color: "var(--payroll-salario)" },
  bonos: { color: "var(--payroll-bonos)" },
  decimo: { color: "var(--payroll-decimo)" },
  vacacion: { color: "var(--payroll-vacacion)" },
  prima: { color: "var(--payroll-prima)" },
  descuentos: { color: "var(--payroll-descuentos)" },
  descuentoPrestamos: { color: "var(--payroll-descuento-prestamos)" },
  prestamos: { color: "var(--payroll-prestamos)" },
  total: { color: "var(--payroll-total)" },
};

/** Clave i18n de cada categoría, para las leyendas. El componente
 *  resuelve con `t(lang, strings.planilla[key])`. */
export const PAYROLL_CATEGORY_LABEL_KEY: Record<
  PayrollCategoryKey,
  | "cat_salario"
  | "cat_bonos"
  | "cat_decimo"
  | "cat_vacacion"
  | "cat_prima"
  | "cat_descuentos"
  | "cat_descuento_prestamos"
  | "cat_prestamos"
  | "cat_total"
> = {
  salario: "cat_salario",
  bonos: "cat_bonos",
  decimo: "cat_decimo",
  vacacion: "cat_vacacion",
  prima: "cat_prima",
  descuentos: "cat_descuentos",
  descuentoPrestamos: "cat_descuento_prestamos",
  prestamos: "cat_prestamos",
  total: "cat_total",
};

/** Fondo tenue teñido para un badge/ícono de categoría — misma técnica
 *  `color-mix` que usa Atlas, para no tener que elegir a mano un color
 *  saturado por componente. */
export function payrollCategoryTint(key: PayrollCategoryKey, opacity = 14): React.CSSProperties {
  return { backgroundColor: `color-mix(in oklch, ${PAYROLL_CATEGORY[key].color} ${opacity}%, transparent)` };
}

export function payrollCategoryTextStyle(key: PayrollCategoryKey): React.CSSProperties {
  return { color: PAYROLL_CATEGORY[key].color };
}

/**
 * Paleta de Planilla — mismo concepto que `LedgerPalette` de Contratistas
 * (`src/lib/contractors/contractor-colors.ts`):
 *   - "full"  → celdas/filas teñidas por su categoría.
 *   - "sober" → neutro, sin tinte.
 * Cada pantalla (Registro, Auditoría) recuerda su propia elección aparte
 * en localStorage; no es un solo interruptor global.
 */
export type PayrollPalette = "full" | "sober";

/** Encabezado de una columna de Registro teñida por categoría. En
 *  "sober" queda neutro (solo el ancho mínimo) — mismas proporciones
 *  (14%) que ya usaba Registro en "full". */
export function payrollFieldHeaderStyle(
  category: PayrollCategoryKey | undefined,
  minWidth: number,
  palette: PayrollPalette = "full"
): React.CSSProperties {
  if (!category || palette === "sober") return { minWidth };
  const color = PAYROLL_CATEGORY[category].color;
  return { minWidth, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`, color };
}

/** Celda de esa misma columna — mismo criterio, proporción más tenue
 *  (4%) que ya usaba Registro en "full". */
export function payrollFieldCellStyle(
  category: PayrollCategoryKey | undefined,
  minWidth: number,
  palette: PayrollPalette = "full"
): React.CSSProperties {
  if (!category || palette === "sober") return { minWidth };
  const color = PAYROLL_CATEGORY[category].color;
  return { minWidth, backgroundColor: `color-mix(in oklch, ${color} 4%, transparent)` };
}

/** Los 4 tonos de una fila de GRUPO de Auditoría (encabezado del grupo,
 *  línea de detalle, borde, color de texto/ícono) — mismas proporciones
 *  (10%/3%/38%) que ya usaba Auditoría en "full". En "sober" quedan
 *  neutros; el color de categoría se conserva aparte (un punto junto a
 *  la etiqueta), igual criterio que Contratistas. */
export interface PayrollGroupRowStyle {
  color: string;
  headerBg: string;
  lineBg: string;
  borderColor: string;
}

export function payrollCategoryRowStyle(
  category: PayrollCategoryKey,
  palette: PayrollPalette = "full"
): PayrollGroupRowStyle {
  const color = PAYROLL_CATEGORY[category].color;
  if (palette === "sober") {
    return {
      color: "var(--foreground)",
      headerBg: "var(--muted)",
      lineBg: "var(--card)",
      borderColor: "var(--border)",
    };
  }
  return {
    color,
    headerBg: `color-mix(in oklch, ${color} 10%, var(--card))`,
    lineBg: `color-mix(in oklch, ${color} 3%, var(--card))`,
    borderColor: `color-mix(in oklch, ${color} 38%, transparent)`,
  };
}

/**
 * Color de identidad de un empleado — eje independiente del de
 * categorías. Se asigna por `employee.sortOrder` (no un hash del id):
 * es un campo intrínseco, igual en todas las vistas sin importar qué
 * subconjunto de empleados tenga cada una en memoria, así cada empleado
 * tiene un color genuinamente distinto sin coordinación entre vistas.
 * Los 8 valores viven como tokens `--employee-accent-N` en globals.css.
 */
const EMPLOYEE_ACCENT_COUNT = 8;

export function employeeAccentColor(sortOrder: number): string {
  const index = ((sortOrder % EMPLOYEE_ACCENT_COUNT) + EMPLOYEE_ACCENT_COUNT) % EMPLOYEE_ACCENT_COUNT;
  return `var(--employee-accent-${index + 1})`;
}

export function employeeAccentTint(sortOrder: number, opacity = 10): React.CSSProperties {
  return { backgroundColor: `color-mix(in oklch, ${employeeAccentColor(sortOrder)} ${opacity}%, transparent)` };
}
