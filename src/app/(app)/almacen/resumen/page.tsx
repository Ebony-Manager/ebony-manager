import { requireModule } from "@/lib/auth/dal";
import { hasAnyModule } from "@/lib/auth/modules";
import { getCatalog, getInventoryPeople, getMovements, getPurchaseOrders, getSuppliers, getWarehouseProjects } from "@/services/almacen";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { AlmacenSummaryView } from "./almacen-summary-view";

// Almacén → Resumen: consumo, stock parado y compras (tendencias). Lo ve
// quien tiene Almacén; los montos solo salen con Compras o Costos (la RLS
// manda los costos vacíos al resto).
export const dynamic = "force-dynamic";

export default async function AlmacenResumenPage() {
  const profile = await requireModule("almacen");
  const since = `${currentPeriod().year - 1}-01-01`;
  const [movements, items, people, projects, suppliers, orders] = await Promise.all([
    getMovements(20000, since),
    getCatalog(),
    getInventoryPeople(),
    getWarehouseProjects(),
    getSuppliers(),
    getPurchaseOrders(1000),
  ]);
  // Sin Compras ni Costos no se muestra ninguna tarjeta de dinero (la RLS ya manda los costos vacíos).
  const canCosts = hasAnyModule(profile, ["almacen_compras", "almacen_costos"]);
  return <AlmacenSummaryView canCosts={canCosts} movements={movements} items={items} people={people} projects={projects} suppliers={suppliers} orders={orders} />;
}
