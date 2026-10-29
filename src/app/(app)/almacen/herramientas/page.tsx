import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getInventoryPeople, getTools, getWarehouseProjects } from "@/services/almacen";
import { ToolsView } from "./tools-view";

// Almacén → Herramientas: préstamo y devolución. Presta y recibe quien tiene
// Almacén; crea o edita herramientas quien tiene Ajustes de inventario o Compras.
export const dynamic = "force-dynamic";

export default async function HerramientasPage() {
  const profile = await requireModule("almacen");
  const [{ tools, loans }, people, projects] = await Promise.all([getTools(), getInventoryPeople(), getWarehouseProjects()]);
  return (
    <ToolsView
      tools={tools}
      loans={loans}
      people={people}
      projects={projects}
      canEdit={hasModule(profile, "almacen_ajustes") || hasModule(profile, "almacen_compras")}
    />
  );
}
