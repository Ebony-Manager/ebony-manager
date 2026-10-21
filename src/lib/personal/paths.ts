/**
 * Rutas de las fichas del staff. Empleados y contratistas se abren desde
 * Personal → Staff (`/personal/staff/...`); las rutas viejas
 * (`/planilla/[id]`, `/contratistas/[id]`) redirigen acá.
 *
 * `from` dice a dónde regresa "Volver" cuando se llegó desde otra pantalla
 * (el Resumen, una pestaña de Pagos…); sin `from`, vuelve a Staff. Los
 * valores conservan sus nombres viejos ("registro", "auditoria",
 * "dashboard") porque pueden venir en enlaces guardados.
 */

export const RESUMEN_PATH = "/personal";
export const PAGOS_PATH = "/personal/pagos";

export const STAFF_PATH = "/personal/staff";

/** Pantallas que abren la ficha de un empleado. */
export const EMPLOYEE_FROM = ["dashboard", "registro", "auditoria", "prestamos", "resumen"] as const;
export type EmployeeFrom = (typeof EMPLOYEE_FROM)[number];

/** Pantallas fuera de Staff que abren la ficha de un contratista ("contratistas" = su Resumen). */
export const CONTRACTOR_FROM = ["contratistas", "pagos", "resumen"] as const;
export type ContractorFrom = (typeof CONTRACTOR_FROM)[number];

const withFrom = (path: string, from?: string) => (from ? `${path}?from=${from}` : path);

export function employeeProfilePath(id: string, from?: EmployeeFrom): string {
  return withFrom(`${STAFF_PATH}/empleados/${id}`, from);
}

export function contractorProfilePath(id: string, from?: ContractorFrom): string {
  return withFrom(`${STAFF_PATH}/contratistas/${id}`, from);
}

export function parseEmployeeFrom(value: string | undefined): EmployeeFrom | undefined {
  return EMPLOYEE_FROM.find((f) => f === value);
}

export function parseContractorFrom(value: string | undefined): ContractorFrom | undefined {
  return CONTRACTOR_FROM.find((f) => f === value);
}

const EMPLOYEE_BACK: Record<EmployeeFrom, string> = {
  resumen: RESUMEN_PATH,
  dashboard: `${RESUMEN_PATH}?ver=empleados`,
  registro: `${PAGOS_PATH}?tab=quincena`,
  auditoria: `${PAGOS_PATH}?tab=historial`,
  prestamos: `${PAGOS_PATH}?tab=prestamos`,
};

const CONTRACTOR_BACK: Record<ContractorFrom, string> = {
  resumen: RESUMEN_PATH,
  contratistas: `${RESUMEN_PATH}?ver=contratistas`,
  pagos: `${PAGOS_PATH}?tab=contratistas`,
};

/** A dónde vuelve la ficha del empleado. */
export function employeeBackPath(from?: EmployeeFrom): string {
  return from ? EMPLOYEE_BACK[from] : STAFF_PATH;
}

/** A dónde vuelve la ficha del contratista. */
export function contractorBackPath(from?: ContractorFrom): string {
  return from ? CONTRACTOR_BACK[from] : STAFF_PATH;
}
