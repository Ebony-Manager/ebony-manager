import { requireModule } from "@/lib/auth/dal";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { PlanillaClient } from "./planilla-client";

// Planilla requiere el módulo `planilla`. `requireModule()` rebota a quien
// no lo tiene (a su módulo de inicio) antes de cargar nada; la RLS de las
// tablas es la última línea. `force-dynamic` porque los datos cambian por acción
// del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function PlanillaPage() {
  await requireModule("planilla");
  const employees = await getPayrollEmployees();

  const photoUrls = await getEmployeePhotoUrls(employees);

  return <PlanillaClient employees={employees} photoUrls={photoUrls} />;
}
