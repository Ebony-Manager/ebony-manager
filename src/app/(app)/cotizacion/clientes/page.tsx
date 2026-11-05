import { requireModule } from "@/lib/auth/dal";
import { getClients, getOpportunities, getSalesProjects } from "@/services/ventas";
import { ClientsView } from "./clients-view";
import { getQuoteSummaries } from "@/services/cotizador";

// Cotización → Clientes: arquitectos/diseñadores y clientes finales, con lo
// que se les ha cotizado y aprobado.
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireModule("cotizacion");
  const [clients, opportunities, projects, quotes] = await Promise.all([getClients(), getOpportunities(), getSalesProjects(), getQuoteSummaries()]);
  return <ClientsView clients={clients} opportunities={opportunities} projects={projects} quotes={quotes} />;
}
