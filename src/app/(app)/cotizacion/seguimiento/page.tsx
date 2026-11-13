import { requireModule } from "@/lib/auth/dal";
import { getClients, getOpportunities, getSalesPeople, getSalesProjects } from "@/services/ventas";
import { getDesignerCandidates } from "@/services/project-designers";
import { driveEnabled } from "@/lib/google/drive";
import { PipelineView } from "./pipeline-view";

// Cotización → Seguimiento: lo que llega para cotizar (reemplaza la lista
// "Prospectos" de ClickUp). Todos los que tienen Cotización ven todo.
export const dynamic = "force-dynamic";

export default async function SeguimientoPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const profile = await requireModule("cotizacion");
  const [{ abrir }, opportunities, clients, people, projects, designerCandidates] = await Promise.all([
    searchParams,
    getOpportunities(),
    getClients(),
    getSalesPeople(),
    getSalesProjects(),
    getDesignerCandidates().catch(() => []),
  ]);
  return <PipelineView opportunities={opportunities} clients={clients} people={people} projects={projects} designerCandidates={designerCandidates} openId={abrir ?? null} driveEnabled={driveEnabled()} currentUserId={profile.id} />;
}
