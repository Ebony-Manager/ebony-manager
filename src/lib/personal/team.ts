import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";
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

export interface TeamMember {
  kind: TeamMemberKind;
  id: string;
  name: string;
  group: TeamGroup;
  /** Puesto del empleado; los contratistas no tienen. */
  position: string | null;
  phone: string | null;
  startDate: string | null;
  active: boolean;
  /** Saldo del contratista con Ebony (positivo = Ebony le debe); null en empleados. */
  balanceCents: number | null;
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
    position: e.position,
    phone: e.phone,
    startDate: e.startDate,
    active: e.status === "ACTIVE",
    balanceCents: null,
    href: employeeProfilePath(e.id),
    sortOrder: e.sortOrder,
  };
}

export function contractorToMember(c: Contractor & { balanceCents?: number }): TeamMember {
  return {
    kind: "contractor",
    id: c.id,
    name: c.name,
    group: c.contractorType,
    position: null,
    phone: c.phone,
    startDate: c.startDate,
    active: c.status === "ACTIVE",
    balanceCents: c.balanceCents ?? null,
    href: contractorProfilePath(c.id),
    sortOrder: c.sortOrder,
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
