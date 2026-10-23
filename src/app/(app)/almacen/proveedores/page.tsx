import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getSuppliers } from "@/services/almacen";
import { SuppliersView } from "./suppliers-view";

// Proveedores: los ve Almacén; los agrega y edita Compras.
export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  const profile = await requireModule("almacen");
  const suppliers = await getSuppliers();
  return <SuppliersView suppliers={suppliers} canEdit={hasModule(profile, "almacen_compras")} />;
}
