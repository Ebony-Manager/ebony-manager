import { requireModule } from "@/lib/auth/dal";
import { getInspectionProjects, getInspectionStats } from "@/services/inspections";
import { InspectionsHome } from "./inspections-home";

// Inspecciones: los proyectos (sin montos) con sus visitas y pendientes; de
// ahí a las inspecciones de cada uno.
export const dynamic = "force-dynamic";

export default async function InspeccionesPage() {
  await requireModule("inspecciones");
  const [projects, stats] = await Promise.all([getInspectionProjects(), getInspectionStats()]);
  return <InspectionsHome projects={projects} stats={stats} />;
}
