import { requireModule } from "@/lib/auth/dal";
import { getCatalog, getCategories } from "@/services/almacen";
import { CountSheet } from "./count-sheet";

// Almacén → Inventario → Hoja de conteo: la lista para imprimir y contar a
// mano (con foto); lo contado se carga después con Ajustar.
export const dynamic = "force-dynamic";

export default async function ConteoPage() {
  await requireModule("almacen");
  const [items, categories] = await Promise.all([getCatalog(), getCategories()]);
  return <CountSheet items={items} categories={categories} />;
}
