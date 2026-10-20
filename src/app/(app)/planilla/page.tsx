import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { getContractors } from "@/services/contractors";
import { getPendingMoneyRequests } from "@/services/money-requests";
import { PlanillaClient } from "./planilla-client";

// Planilla requiere el módulo `planilla`. `requireModule()` rebota a quien
// no lo tiene (a su módulo de inicio) antes de cargar nada; la RLS de las
// tablas es la última línea. `force-dynamic` porque los datos cambian por acción
// del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function PlanillaPage() {
  const profile = await requireModule("planilla");
  const canContractors = hasModule(profile, "contratistas");
  // Solicitudes de dinero (Préstamos): los contratistas solo si el usuario los ve.
  const [employees, moneyRequests, contractors] = await Promise.all([
    getPayrollEmployees(),
    getPendingMoneyRequests(),
    canContractors ? getContractors() : Promise.resolve([]),
  ]);

  const photoUrls = await getEmployeePhotoUrls(employees);

  return (
    <PlanillaClient
      employees={employees}
      photoUrls={photoUrls}
      moneyRequests={moneyRequests}
      contractors={contractors}
      canContractors={canContractors}
    />
  );
}
