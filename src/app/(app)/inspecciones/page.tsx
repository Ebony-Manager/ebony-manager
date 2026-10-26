import { requireModule } from "@/lib/auth/dal";
import { getInspectionOverview, getInspectionProjects } from "@/services/inspections";
import { InspectionsHome } from "./inspections-home";

// Inspecciones: lo abierto (obras con pendientes, últimas visitas) y el botón
// para empezar una inspección nueva.
export const dynamic = "force-dynamic";

export default async function InspeccionesPage() {
  await requireModule("inspecciones");
  const [projects, overview] = await Promise.all([getInspectionProjects(), getInspectionOverview()]);
  return <InspectionsHome projects={projects} overview={overview} />;
}
