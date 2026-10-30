import { requireModule } from "@/lib/auth/dal";
import { getClients, getOpportunities, getSalesProjects } from "@/services/ventas";
import { ClientsView } from "./clients-view";

// Cotización → Clientes: arquitectos/diseñadores y clientes finales, con lo
// que se les ha cotizado y aprobado.
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireModule("cotizacion");
  const [clients, opportunities, projects] = await Promise.all([getClients(), getOpportunities(), getSalesProjects()]);
  return <ClientsView clients={clients} opportunities={opportunities} projects={projects} />;
}
