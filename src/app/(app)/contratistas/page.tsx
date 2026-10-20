import { requireModule } from "@/lib/auth/dal";
import {
  getContractorsDashboardInput,
  getContractorsWithBalance,
  getLaborRates,
  getProjects,
} from "@/services/contractors";
import { ContratistasClient } from "./contratistas-client";

// Contratistas requiere el módulo `contratistas`. `requireModule()` rebota
// a quien no lo tiene (a su módulo de inicio) antes de cargar nada; la RLS
// de las tablas es la última línea. `force-dynamic` porque los datos
// cambian por acción del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function ContratistasPage() {
  await requireModule("contratistas");
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
