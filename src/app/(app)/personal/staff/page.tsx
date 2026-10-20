import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { contractorToMember, employeeToMember, sortTeam } from "@/lib/personal/team";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { getContractorPhotoUrls, getContractors } from "@/services/contractors";
import { StaffClient } from "./staff-client";

// Personal → Staff: empleados + contratistas en una sola lista. Alcanza con
// uno de los dos módulos, y cada quien ve solo los de su(s) módulo(s) — la RLS
// de cada tabla repite la regla. Es solo lectura: cada fila lleva a la ficha
// donde se edita. `force-dynamic` porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const profile = await requireAnyModule("planilla", "contratistas");
  const canEmployees = hasModule(profile, "planilla");
  const canContractors = hasModule(profile, "contratistas");

  const [employees, contractors] = await Promise.all([
    canEmployees ? getPayrollEmployees() : Promise.resolve([]),
    canContractors ? getContractors() : Promise.resolve([]),
  ]);
  const [photoUrls, contractorPhotoUrls] = await Promise.all([
    canEmployees ? getEmployeePhotoUrls(employees) : Promise.resolve({}),
    canContractors ? getContractorPhotoUrls(contractors) : Promise.resolve({}),
  ]);

  const members = sortTeam([...employees.map(employeeToMember), ...contractors.map(contractorToMember)]);
  return (
    <StaffClient
      members={members}
      photoUrls={photoUrls}
      contractorPhotoUrls={contractorPhotoUrls}
      showKindFilter={canEmployees && canContractors}
    />
  );
}
