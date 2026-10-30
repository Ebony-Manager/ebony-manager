import { requireModule } from "@/lib/auth/dal";
import { getClients, getOpportunities, getSalesPeople, getSalesProjects } from "@/services/ventas";
import { driveEnabled } from "@/lib/google/drive";
import { PipelineView } from "./pipeline-view";

// Cotización → Seguimiento: lo que llega para cotizar (reemplaza la lista
// "Prospectos" de ClickUp). Todos los que tienen Cotización ven todo.
export const dynamic = "force-dynamic";

export default async function SeguimientoPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const profile = await requireModule("cotizacion");
  const [{ abrir }, opportunities, clients, people, projects] = await Promise.all([
    searchParams,
    getOpportunities(),
    getClients(),
    getSalesPeople(),
    getSalesProjects(),
  ]);
  return <PipelineView opportunities={opportunities} clients={clients} people={people} projects={projects} openId={abrir ?? null} driveEnabled={driveEnabled()} currentUserId={profile.id} />;
}
