import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { directoryToMember, sortTeam } from "@/lib/personal/team";
import { getPayrollEmployees } from "@/services/payroll-employees";
import { getContractors } from "@/services/contractors";
import { getPayrollPositions } from "@/services/payroll-positions";
import { getPendingIntake } from "@/services/staff-intake";
import { getStaffDirectory } from "@/services/staff-directory";
import type { MatchCandidate } from "@/lib/personal/jotform-intake";
import { StaffClient } from "./staff-client";

// Personal → Staff: empleados + contratistas en una sola lista, de donde se
// abre la ficha de cada uno y se descargan sus documentos. Pide el permiso
// Personal (`documentos`); la lista sale de `staff_people()`, que no trae
// dinero. Agregar personas, los registros de JotForm y exportar el listado
// piden además Planilla (empleados) o Contratistas (contratistas), y solo
// para esos se cargan las tablas completas. `force-dynamic` porque los
// datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const profile = await requireModule("documentos");
  const canEmployees = hasModule(profile, "planilla");
  const canContractors = hasModule(profile, "contratistas");

  const [people, employees, contractors, positions, intakes] = await Promise.all([
    getStaffDirectory(),
    canEmployees ? getPayrollEmployees() : Promise.resolve([]),
    canContractors ? getContractors() : Promise.resolve([]),
    canEmployees ? getPayrollPositions() : Promise.resolve([]),
    canEmployees || canContractors ? getPendingIntake() : Promise.resolve([]),
  ]);

  const candidates: MatchCandidate[] = [
    ...employees.map((e) => ({ kind: "employee" as const, id: e.id, name: e.name, email: e.email, phone: e.phone })),
    ...contractors.map((c) => ({ kind: "contractor" as const, id: c.id, name: c.name, email: c.email, phone: c.phone })),
  ];
  const photo = (kind: "employee" | "contractor") =>
    Object.fromEntries(people.filter((p) => p.kind === kind && p.photoUrl).map((p) => [p.id, p.photoUrl as string]));

  return (
    <StaffClient
      members={sortTeam(people.map(directoryToMember))}
      people={people}
      employees={employees}
      contractors={contractors}
      intakes={intakes}
      candidates={candidates}
      positions={positions}
      photoUrls={photo("employee")}
      contractorPhotoUrls={photo("contractor")}
      canEmployees={canEmployees}
      canContractors={canContractors}
    />
  );
}
