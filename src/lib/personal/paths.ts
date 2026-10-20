/**
 * Rutas de las fichas del staff. Empleados y contratistas se abren desde
 * Personal → Staff (`/personal/staff/...`); las rutas viejas
 * (`/planilla/[id]`, `/contratistas/[id]`) redirigen acá.
 *
 * `from` dice a dónde regresa "Volver" cuando se llegó desde otra pantalla
 * (el Dashboard de Planilla, el Resumen…); sin `from`, vuelve a Staff.
 */

export const STAFF_PATH = "/personal/staff";

/** Pantallas de Planilla que abren la ficha de un empleado. */
export const EMPLOYEE_FROM = ["dashboard", "registro", "auditoria", "prestamos", "resumen"] as const;
export type EmployeeFrom = (typeof EMPLOYEE_FROM)[number];

/** Pantallas fuera de Staff que abren la ficha de un contratista. */
export const CONTRACTOR_FROM = ["contratistas", "resumen"] as const;
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

/** A dónde vuelve la ficha del empleado. */
export function employeeBackPath(from?: EmployeeFrom): string {
  if (from === "resumen") return "/personal";
  return from ? `/planilla?tab=${from}` : STAFF_PATH;
}

/** A dónde vuelve la ficha del contratista. */
export function contractorBackPath(from?: ContractorFrom): string {
  if (from === "resumen") return "/personal";
  return from === "contratistas" ? "/contratistas" : STAFF_PATH;
}
