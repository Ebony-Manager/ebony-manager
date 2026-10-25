import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getCatalog, getCategories, getInventoryPeople, getMovements, getSuppliers, getWarehouseProjects } from "@/services/almacen";
import { MovementsView, type MovementFilter } from "./movements-view";

// Almacén → Inventario → Movimientos: todo lo que entró, salió o se ajustó.
// Se llega desde el botón de Inventario; "Ajustar" vive aquí y allá.
export const dynamic = "force-dynamic";

const FILTERS: MovementFilter[] = ["all", "salida", "recepcion", "ajuste"];

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const profile = await requireModule("almacen");
  const { tipo } = await searchParams;
  const [movements, items, categories, people, suppliers, projects] = await Promise.all([
    getMovements(),
    getCatalog(),
    getCategories(),
    getInventoryPeople(),
    getSuppliers(),
    getWarehouseProjects(),
  ]);
  return (
    <MovementsView
      movements={movements}
      items={items}
      categories={categories}
      people={people}
      suppliers={suppliers}
      projects={projects}
      initialFilter={FILTERS.includes(tipo as MovementFilter) ? (tipo as MovementFilter) : "all"}
      canAdjust={hasModule(profile, "almacen_ajustes")}
    />
  );
}
