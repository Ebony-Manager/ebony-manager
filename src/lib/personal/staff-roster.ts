import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor } from "@/types/contractors";

/**
 * Modelo (sin dibujar) de la lista del staff para imprimir: una fila por
 * persona — empleado de planilla o contratista — con todo lo de su ficha, ya
 * en texto. Puro y probado; el PDF dibuja lo mismo a partir de acá.
 */
export interface RosterLabels {
  cedula: string;
  pasaporte: string;
  taller: string;
  administrativo: string;
  /** "Contratista": va delante del oficio en la columna Tipo. */
  contractor: string;
  ebanista: string;
  pintor: string;
  ahorro: string;
  corriente: string;
  active: string;
  inactive: string;
  /** Nombre del país de la nacionalidad (se guarda el código, ej. "PA"). */
  country: (code: string) => string;
}

export interface RosterRow {
  id: string;
  n: number;
  name: string;
  position: string;
  type: string;
  startDate: string;
  document: string;
  nationality: string;
  birthDate: string;
  phone: string;
  bank: string;
  emergency: string;
  endDate: string;
  status: string;
  isActive: boolean;
}

/** A quién incluye la lista. */
export type RosterKind = "all" | "employee" | "contractor";

const dash = "–";

/** Lo que tienen en común la ficha del empleado y la del contratista. */
type Person = Pick<
  PayrollEmployee,
  | "id"
  | "name"
  | "status"
  | "startDate"
  | "endDate"
  | "idDocument"
  | "idDocumentType"
  | "nationality"
  | "birthDate"
  | "phone"
  | "bankName"
  | "bankAccountType"
  | "bankAccountNumber"
  | "emergencyContactName"
  | "emergencyContactPhone"
>;

function personRow(
  p: Person,
  n: number,
  position: string | null,
  type: string,
  fmtDate: (iso: string) => string,
  labels: RosterLabels
): RosterRow {
  const docKind = p.idDocumentType === "pasaporte" ? labels.pasaporte : p.idDocumentType === "cedula" ? labels.cedula : "";
  const accountType =
    p.bankAccountType === "ahorro" ? labels.ahorro : p.bankAccountType === "corriente" ? labels.corriente : "";
  const bank = [p.bankName, accountType, p.bankAccountNumber].filter(Boolean).join(" · ");
  const emergency = [p.emergencyContactName, p.emergencyContactPhone].filter(Boolean).join(" · ");
  return {
    id: p.id,
    n,
    name: p.name,
    position: position || dash,
    type,
    startDate: p.startDate ? fmtDate(p.startDate) : dash,
    document: p.idDocument ? [docKind, p.idDocument].filter(Boolean).join(" ") : dash,
    nationality: p.nationality ? labels.country(p.nationality) : dash,
    birthDate: p.birthDate ? fmtDate(p.birthDate) : dash,
    phone: p.phone || dash,
    bank: bank || dash,
    emergency: emergency || dash,
    endDate: p.endDate ? fmtDate(p.endDate) : dash,
    status: p.status === "ACTIVE" ? labels.active : labels.inactive,
    isActive: p.status === "ACTIVE",
  };
}

/** Empleados primero (en su orden de Planilla) y luego contratistas, numerados seguido. */
export function buildRoster(
  people: { employees: readonly PayrollEmployee[]; contractors: readonly Contractor[] },
  options: { includeInactive: boolean; kind: RosterKind },
  fmtDate: (iso: string) => string,
  labels: RosterLabels
): RosterRow[] {
  const keep = <T extends { status: string }>(list: readonly T[]) =>
    options.includeInactive ? list : list.filter((p) => p.status === "ACTIVE");
  const employees = options.kind === "contractor" ? [] : keep(people.employees);
  const contractors = options.kind === "employee" ? [] : keep(people.contractors);

  const rows: RosterRow[] = [];
  for (const e of employees) {
    const type = e.categoria === "administrativo" ? labels.administrativo : labels.taller;
    rows.push(personRow(e, rows.length + 1, e.position, type, fmtDate, labels));
  }
  for (const c of contractors) {
    const trade = c.contractorType === "pintor" ? labels.pintor : labels.ebanista;
    rows.push(personRow(c, rows.length + 1, null, `${labels.contractor} · ${trade}`, fmtDate, labels));
  }
  return rows;
}
