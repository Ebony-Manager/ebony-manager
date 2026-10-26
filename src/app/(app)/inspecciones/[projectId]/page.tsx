import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasAnyModule } from "@/lib/auth/modules";
import { getInspectionPainters, getInspectionProject, getProjectInspections } from "@/services/inspections";
import { ProjectInspections } from "./project-inspections";

// Las inspecciones de un proyecto (la herramienta suelta: para quien solo
// tiene Inspecciones, sin la ficha del proyecto).
export const dynamic = "force-dynamic";

export default async function ProjectInspectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const profile = await requireModule("inspecciones");
  const [{ projectId }, { nueva }] = await Promise.all([params, searchParams]);
  const [project, inspections, painters] = await Promise.all([getInspectionProject(projectId), getProjectInspections(projectId), getInspectionPainters()]);
  if (!project) notFound();
  return <ProjectInspections project={project} inspections={inspections} painters={painters} canOpenProject={hasAnyModule(profile, ["proyectos", "contratistas"])} startNew={nueva === "1"} />;
}
