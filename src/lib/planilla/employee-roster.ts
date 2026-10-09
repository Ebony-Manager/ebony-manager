import type { PayrollEmployee } from "@/types/planilla";

/**
 * Modelo (sin dibujar) de la tabla "Empleados" para ver e imprimir: una fila
 * por empleado con todo lo de su ficha, ya en texto. Puro y probado; la
 * pantalla y el PDF dibujan lo mismo a partir de acá.
 */
export interface RosterLabels {
  cedula: string;
  pasaporte: string;
  taller: string;
  administrativo: string;
  ahorro: string;
  corriente: string;
  active: string;
  inactive: string;
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

const dash = "–";

export function buildRoster(
  employees: readonly PayrollEmployee[],
  options: { includeInactive: boolean },
  fmtDate: (iso: string) => string,
  labels: RosterLabels
): RosterRow[] {
  const list = options.includeInactive ? employees : employees.filter((e) => e.status === "ACTIVE");
  return list.map((e, i) => {
    const docKind = e.idDocumentType === "pasaporte" ? labels.pasaporte : e.idDocumentType === "cedula" ? labels.cedula : "";
    const accountType =
      e.bankAccountType === "ahorro" ? labels.ahorro : e.bankAccountType === "corriente" ? labels.corriente : "";
    const bank = [e.bankName, accountType, e.bankAccountNumber].filter(Boolean).join(" · ");
    const emergency = [e.emergencyContactName, e.emergencyContactPhone].filter(Boolean).join(" · ");
    return {
      id: e.id,
      n: i + 1,
      name: e.name,
      position: e.position || dash,
      type: e.categoria === "administrativo" ? labels.administrativo : labels.taller,
      startDate: e.startDate ? fmtDate(e.startDate) : dash,
      document: e.idDocument ? [docKind, e.idDocument].filter(Boolean).join(" ") : dash,
      nationality: e.nationality || dash,
      birthDate: e.birthDate ? fmtDate(e.birthDate) : dash,
      phone: e.phone || dash,
      bank: bank || dash,
      emergency: emergency || dash,
      endDate: e.endDate ? fmtDate(e.endDate) : dash,
      status: e.status === "ACTIVE" ? labels.active : labels.inactive,
      isActive: e.status === "ACTIVE",
    };
  });
}
