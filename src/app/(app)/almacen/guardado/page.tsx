import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getPurchaseRequests, getSuppliers, getWarehouseProjects } from "@/services/almacen";
import { getIncomingItems, getStoredItems, getStoredPeople } from "@/services/guardado";
import { StoredView } from "./stored-view";

// Almacén → Apartados: cosas de un solo proyecto guardadas hasta usarlas (lo especial que se compró y
// lo que trajo el cliente). Entran Almacén, Diseño y Proyectos (sobre todo las diseñadoras); el costo, solo
// Compras y Costos del almacén. `?proyecto=` abre filtrado (desde la ficha del proyecto).
export const dynamic = "force-dynamic";

export default async function GuardadoPage({ searchParams }: { searchParams: Promise<{ proyecto?: string }> }) {
  const profile = await requireAnyModule("almacen", "diseno", "proyectos");
  const [{ proyecto }, items, incoming, people, projects, suppliers, requests] = await Promise.all([
    searchParams,
    getStoredItems(),
    getIncomingItems(),
    getStoredPeople(),
    getWarehouseProjects(),
    hasModule(profile, "almacen") ? getSuppliers() : Promise.resolve([]),
    // La RLS de Compras decide: las suyas, o todas con Compras (las mismas que puede editar).
    getPurchaseRequests().then((rs) => rs.filter((r) => r.forProject)),
  ]);
  return (
    <StoredView
      items={items}
      incoming={incoming}
      myRequests={requests}
      people={people}
      projects={projects}
      suppliers={suppliers}
      canCosts={hasModule(profile, "almacen_compras") || hasModule(profile, "almacen_costos")}
      initialProjectId={proyecto ?? null}
    />
  );
}
