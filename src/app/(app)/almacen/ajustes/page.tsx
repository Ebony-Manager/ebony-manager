import { requireModule } from "@/lib/auth/dal";
import { getAdjustments, getCatalog, getCategories } from "@/services/almacen";
import { AdjustmentsView } from "./adjustments-view";

// Almacén → Ajustes: conteos, daños, pérdidas y correcciones. Solo con
// "Ajustes de inventario". La carga inicial del inventario se hace aquí.
export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  await requireModule("almacen", "almacen_ajustes");
  const [adjustments, items, categories] = await Promise.all([getAdjustments(), getCatalog(), getCategories()]);
  return <AdjustmentsView adjustments={adjustments} items={items} categories={categories} />;
}
