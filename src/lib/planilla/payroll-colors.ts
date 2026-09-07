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
  descuentoPrestamos: { color: "var(--payroll-descuentos)" },
  prestamos: { color: "var(--payroll-prestamos)" },
  total: { color: "var(--payroll-total)" },
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
