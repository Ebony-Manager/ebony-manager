import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getCatalog, getCategories, getSuppliers } from "@/services/almacen";
import { StockView } from "./stock-view";

// Almacén → Inventario (desde aquí: Movimientos y Ajustar). Entra quien tiene Almacén; Compras edita el
// catálogo; los costos y el valor se ven con Compras o Costos del almacén
// (la RLS los manda vacíos al resto).
export const dynamic = "force-dynamic";

export default async function AlmacenPage() {
  const profile = await requireModule("almacen");
  const [items, categories, suppliers] = await Promise.all([getCatalog(), getCategories(), getSuppliers()]);
  return (
    <StockView
      items={items}
      categories={categories}
      suppliers={suppliers}
      canEdit={hasModule(profile, "almacen_compras")}
      canCosts={hasModule(profile, "almacen_compras") || hasModule(profile, "almacen_costos")}
      canAdjust={hasModule(profile, "almacen_ajustes")}
    />
  );
}
