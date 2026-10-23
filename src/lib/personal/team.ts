import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
import type { DirectoryPerson } from "@/types/staff-directory";
import { matchesEmployeeQuery } from "@/lib/planilla/employee-search";
import { contractorProfilePath, employeeProfilePath } from "./paths";

/**
 * Staff: empleados de planilla y contratistas en una sola lista. Cada
 * persona se edita en su ficha (dentro de Staff), a la que enlaza `href`.
 * Puro, sin Supabase ni React.
 */

export type TeamMemberKind = "employee" | "contractor";

/** Taller / Administrativo para empleados; Ebanista / Pintor para contratistas. */
export type TeamGroup = PayrollEmployee["categoria"] | Contractor["contractorType"];

/** Departamento: los empleados según su categoría; los contratistas
 *  ebanistas van a Taller y los pintores a Pintura. */
export type TeamDepartment = "taller" | "pintura" | "administrativo";

export interface TeamMember {
  kind: TeamMemberKind;
  id: string;
  name: string;
  group: TeamGroup;
  department: TeamDepartment;
  /** Puesto del empleado; los contratistas no tienen (se muestra su oficio). */
  position: string | null;
  phone: string | null;
  startDate: string | null;
  active: boolean;
  /** Ficha de la persona, donde se edita. */
  href: string;
  /** Orden propio de su sección — el color del avatar de un empleado sale de acá. */
  sortOrder: number;
}

export type TeamFilter = "all" | TeamMemberKind;

export function employeeToMember(e: PayrollEmployee): TeamMember {
  return {
    kind: "employee",
    id: e.id,
    name: e.name,
    group: e.categoria,
    department: e.categoria,
    position: e.position,
    phone: e.phone,
    startDate: e.startDate,
    active: e.status === "ACTIVE",
    href: employeeProfilePath(e.id),
    sortOrder: e.sortOrder,
  };
}

export function contractorToMember(c: Contractor): TeamMember {
  return {
    kind: "contractor",
    id: c.id,
    name: c.name,
    group: c.contractorType,
    department: c.contractorType === "pintor" ? "pintura" : "taller",
    position: null,
    phone: c.phone,
    startDate: c.startDate,
    active: c.status === "ACTIVE",
    href: contractorProfilePath(c.id),
    sortOrder: c.sortOrder,
  };
}

/** Desde la lista sin dinero (`staff_people()`): sirve para cualquier permiso de Personal. */
export function directoryToMember(p: DirectoryPerson): TeamMember {
  const group = p.group as TeamGroup;
  return {
    kind: p.kind,
    id: p.id,
    name: p.name,
    group,
    department: p.kind === "employee" ? (group as TeamDepartment) : group === "pintor" ? "pintura" : "taller",
    position: p.position,
    phone: p.phone,
    startDate: p.startDate,
    active: p.active,
    href: p.kind === "employee" ? employeeProfilePath(p.id) : contractorProfilePath(p.id),
    sortOrder: p.sortOrder,
  };
}

/** Por nombre (sin importar mayúsculas ni acentos), sin mezclar personas de igual nombre. */
export function sortTeam(members: readonly TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || a.kind.localeCompare(b.kind)
  );
}

/** Filtra por tipo y por nombre (todas las palabras, en cualquier orden). */
export function filterTeam(
  members: readonly TeamMember[],
  { kind, query }: { kind: TeamFilter; query: string }
): TeamMember[] {
  return members.filter((m) => (kind === "all" || m.kind === kind) && matchesEmployeeQuery(m.name, query));
}
