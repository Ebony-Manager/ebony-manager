import { requireAnyModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getSuppliers } from "@/services/almacen";
import { DirectorioView } from "./directorio-view";

// Directorio: los proveedores de la empresa (materiales y servicios). Lo ve
// quien tiene Almacén o Directorio; lo editan Compras y Directorio.
export const dynamic = "force-dynamic";

export default async function DirectorioPage() {
  const profile = await requireAnyModule("almacen", "directorio");
  const suppliers = await getSuppliers();
  return <DirectorioView suppliers={suppliers} canEdit={hasModule(profile, "almacen_compras") || hasModule(profile, "directorio")} />;
}
