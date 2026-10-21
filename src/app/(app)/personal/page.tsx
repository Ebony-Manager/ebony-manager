import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getContractorsDashboardInput } from "@/services/contractors";
import { ResumenClient, type ResumenView } from "./resumen-client";

// Personal → Resumen: uno solo para todo el personal, con filtro Todos /
// Empleados / Contratistas. Cada vista pide su módulo ("Todos", los dos);
// nunca cacheado porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

const VIEWS: ResumenView[] = ["todos", "empleados", "contratistas"];
const parseResumenView = (value: string | undefined) => VIEWS.find((v) => v === value);

export default async function PersonalResumenPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const profile = await requireAnyModule("planilla", "contratistas");
  const canEmployees = hasModule(profile, "planilla");
  const canContractors = hasModule(profile, "contratistas");
  const { ver } = await searchParams;
  const contractorsDashboard = canContractors ? await getContractorsDashboardInput() : null;

  return (
    <ResumenClient
      canEmployees={canEmployees}
      canContractors={canContractors}
      initialView={parseResumenView(ver)}
      contractorsDashboard={contractorsDashboard}
    />
  );
}
