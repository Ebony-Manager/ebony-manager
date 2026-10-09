import { requireAdmin } from "@/lib/auth/dal";
import {
  getContractorsDashboardInput,
  getContractorsWithBalance,
  getLaborRates,
  getProjects,
} from "@/services/contractors";
import { ContratistasClient } from "./contratistas-client";

// El módulo de Contratistas es solo-admin. `requireAdmin()` rebota a un
// no-admin (a /cotizacion) antes de cargar nada; la RLS admin-only de
// las tablas es la última línea. `force-dynamic` porque los datos
// cambian por acción del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function ContratistasPage() {
  await requireAdmin();
  const [contractors, projects, laborRates, dashboard] = await Promise.all([
    getContractorsWithBalance(),
    getProjects(),
    getLaborRates(),
    getContractorsDashboardInput(),
  ]);

  return (
    <ContratistasClient contractors={contractors} projects={projects} laborRates={laborRates} dashboard={dashboard} />
  );
}
