import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getContracts, getProjects } from "@/services/contractors";
import { ProjectsList } from "./projects-list";

// Proyectos: la lista de todas las obras. Entra quien tiene Proyectos o
// Contratistas; los contratos (montos) se cargan solo con Contratistas. La
// RLS es la última línea.
export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const profile = await requireAnyModule("proyectos", "contratistas");
  const canContracts = hasModule(profile, "contratistas");
  const [projects, contracts] = await Promise.all([getProjects(), canContracts ? getContracts() : Promise.resolve([])]);

  return <ProjectsList projects={projects} contracts={contracts} canContracts={canContracts} />;
}
