import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasAnyModule } from "@/lib/auth/modules";
import { getInspectionProject, getProjectInspections } from "@/services/inspections";
import { ProjectInspections } from "./project-inspections";

// Las inspecciones de un proyecto (la herramienta suelta: para quien solo
// tiene Inspecciones, sin la ficha del proyecto).
export const dynamic = "force-dynamic";

export default async function ProjectInspectionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const profile = await requireModule("inspecciones");
  const { projectId } = await params;
  const [project, inspections] = await Promise.all([getInspectionProject(projectId), getProjectInspections(projectId)]);
  if (!project) notFound();
  return <ProjectInspections project={project} inspections={inspections} canOpenProject={hasAnyModule(profile, ["proyectos", "contratistas"])} />;
}
