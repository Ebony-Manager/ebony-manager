import { requireProfile } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getCatalog, getCategories, getPurchaseOrders, getPurchaseRequests, getSuppliers, getWarehouseProjects } from "@/services/almacen";
import { PurchasesView } from "./purchases-view";

// Almacén → Compras. Cualquier usuario entra a pedir y ver sus solicitudes;
// Compras ve todas, las agrupa por proveedor y arma los pedidos; Almacén
// recibe. La RLS decide qué llega a cada uno.
export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const profile = await requireProfile();
  const canWarehouse = hasModule(profile, "almacen");
  const canPurchase = hasModule(profile, "almacen_compras");
  const [requests, items, categories, suppliers, orders, projects] = await Promise.all([
    getPurchaseRequests(),
    getCatalog(),
    getCategories(),
    canWarehouse ? getSuppliers() : Promise.resolve([]),
    canWarehouse ? getPurchaseOrders() : Promise.resolve([]),
    getWarehouseProjects(),
  ]);
  return (
    <PurchasesView
      userId={profile.id}
      requests={requests}
      items={items}
      categories={categories}
      suppliers={suppliers}
      orders={orders}
      projects={projects}
      canWarehouse={canWarehouse}
      canPurchase={canPurchase}
      canCosts={canPurchase || hasModule(profile, "almacen_costos")}
    />
  );
}
