import { notFound } from "next/navigation";

import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getContractors, getContracts, getLaborRates, getProject, getProjects } from "@/services/contractors";
import { getInspectionPainters, getProjectInspections } from "@/services/inspections";
import { ProjectHub } from "./project-hub";

// La ficha de un proyecto: el lugar desde donde se llega a todo lo de la
// obra. Cada sección pide su módulo (Contratos pide Contratistas;
// Inspecciones, Inspecciones) y
// acá solo se carga lo de los módulos que el usuario tiene.
export const dynamic = "force-dynamic";

const none = <T,>(value: T) => Promise.resolve(value);

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireAnyModule("proyectos", "contratistas");
  const canContracts = hasModule(profile, "contratistas");
  const canInspections = hasModule(profile, "inspecciones");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  const project = await getProject(id);
  if (!project) notFound();

  const [contracts, contractors, projects, laborRates, inspections, painters] = await Promise.all([
    canContracts ? getContracts({ projectId: id }) : none([]),
    canContracts ? getContractors() : none([]),
    canContracts ? getProjects() : none([]),
    canContracts ? getLaborRates() : none([]),
    canInspections ? getProjectInspections(id) : none([]),
    canInspections ? getInspectionPainters() : none([]),
  ]);

  return (
    <ProjectHub
      project={project}
      initialTab={tab}
      canContracts={canContracts}
      contracts={contracts}
      contractors={contractors.map((c) => ({ id: c.id, name: c.name, contractorType: c.contractorType }))}
      projects={projects}
      laborRates={laborRates}
      canInspections={canInspections}
      inspections={inspections}
      painters={painters}
    />
  );
}
