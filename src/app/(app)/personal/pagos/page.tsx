import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getEmployeePhotoUrls, getPayrollEmployees } from "@/services/payroll-employees";
import { getContracts, getContractors, getContractorsDashboardInput, getLaborRates, getProjects } from "@/services/contractors";
import { getPendingMoneyRequests } from "@/services/money-requests";
import { PagosClient } from "./pagos-client";

// Personal → Pagos: todo lo que se le paga al personal, en pestañas. Cada
// pestaña pide su módulo (Planilla, Asistencia o Contratistas) y acá solo se
// carga lo de los módulos que el usuario tiene; la RLS es la última línea.
// Con solo Asistencia (ej. jefa de taller) se ve esa pestaña y sin dinero.
// `force-dynamic` porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

const none = <T,>(value: T) => Promise.resolve(value);

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireAnyModule("planilla", "contratistas", "asistencia");
  const canEmployees = hasModule(profile, "planilla");
  const canContractors = hasModule(profile, "contratistas");
  const canAttendance = hasModule(profile, "asistencia");
  const { tab } = await searchParams;

  const [employees, moneyRequests, contractors, contracts, projects, laborRates, contractorsDashboard] = await Promise.all([
    canEmployees ? getPayrollEmployees() : none([]),
    canEmployees || canContractors ? getPendingMoneyRequests() : none([]),
    // Para la bandeja de solicitudes de dinero (Préstamos).
    canContractors ? getContractors() : none([]),
    canContractors ? getContracts() : none([]),
    canContractors ? getProjects() : none([]),
    canContractors ? getLaborRates() : none([]),
    canContractors ? getContractorsDashboardInput() : none(null),
  ]);
  const photoUrls = canEmployees ? await getEmployeePhotoUrls(employees) : {};

  return (
    <PagosClient
      initialTab={tab}
      canEmployees={canEmployees}
      canContractors={canContractors}
      canAttendance={canAttendance}
      employees={employees}
      photoUrls={photoUrls}
      moneyRequests={moneyRequests}
      contractors={contractors}
      contracts={contracts}
      projects={projects}
      laborRates={laborRates}
      contractorsDashboard={contractorsDashboard}
    />
  );
}
