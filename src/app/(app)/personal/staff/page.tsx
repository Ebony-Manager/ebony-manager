import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { contractorToMember, employeeToMember, sortTeam } from "@/lib/personal/team";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { getContractorPhotoUrls, getContractorsWithBalance } from "@/services/contractors";
import { getPayrollPositions } from "@/services/payroll-positions";
import { getPendingIntake } from "@/services/staff-intake";
import type { MatchCandidate } from "@/lib/personal/jotform-intake";
import { StaffClient } from "./staff-client";

// Personal → Staff: empleados + contratistas en una sola lista, el lugar
// donde se agregan y desde donde se abre la ficha de cada uno. Alcanza con
// uno de los dos módulos, y cada quien ve (y agrega) solo los de su(s)
// módulo(s) — la RLS de cada tabla repite la regla. `force-dynamic` porque los
// datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const profile = await requireAnyModule("planilla", "contratistas");
  const canEmployees = hasModule(profile, "planilla");
  const canContractors = hasModule(profile, "contratistas");

  const [employees, contractors, positions, intakes] = await Promise.all([
    canEmployees ? getPayrollEmployees() : Promise.resolve([]),
    canContractors ? getContractorsWithBalance() : Promise.resolve([]),
    canEmployees ? getPayrollPositions() : Promise.resolve([]),
    getPendingIntake(),
  ]);
  const [photoUrls, contractorPhotoUrls] = await Promise.all([
    canEmployees ? getEmployeePhotoUrls(employees) : Promise.resolve({}),
    canContractors ? getContractorPhotoUrls(contractors) : Promise.resolve({}),
  ]);

  const candidates: MatchCandidate[] = [
    ...employees.map((e) => ({ kind: "employee" as const, id: e.id, name: e.name, email: e.email, phone: e.phone })),
    ...contractors.map((c) => ({ kind: "contractor" as const, id: c.id, name: c.name, email: c.email, phone: c.phone })),
  ];
  const members = sortTeam([...employees.map(employeeToMember), ...contractors.map(contractorToMember)]);
  return (
    <StaffClient
      members={members}
      employees={employees}
      contractors={contractors}
      intakes={intakes}
      candidates={candidates}
      positions={positions}
      photoUrls={photoUrls}
      contractorPhotoUrls={contractorPhotoUrls}
      canEmployees={canEmployees}
      canContractors={canContractors}
    />
  );
}
