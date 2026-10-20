import { requireModule } from "@/lib/auth/dal";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { getPayrollPositions } from "@/services/payroll-positions";
import { PlanillaClient } from "./planilla-client";

// Planilla requiere el módulo `planilla`. `requireModule()` rebota a quien
// no lo tiene (a su módulo de inicio) antes de cargar nada; la RLS de las
// tablas es la última línea. `force-dynamic` porque los datos cambian por acción
// del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function PlanillaPage() {
  await requireModule("planilla");
  const [employees, positions] = await Promise.all([getPayrollEmployees(), getPayrollPositions()]);

  const photoUrls = await getEmployeePhotoUrls(employees);

  return <PlanillaClient employees={employees} positions={positions} photoUrls={photoUrls} />;
}
