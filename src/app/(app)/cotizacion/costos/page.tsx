import { requireAdmin } from "@/lib/auth/dal";
import { getCatalog, getCostInputs, getRecipes } from "@/services/cotizador";
import { CostosClient } from "./costos-client";

// Pantalla de Costos: solo-admin y fuera del menú (se llega por el enlace
// discreto del cotizador). Acá vive lo que antes era la "HOJA DE CALCULO
// oficial": insumos, recetas y el precio para cotizar de cada renglón.
export const dynamic = "force-dynamic";

export default async function CostosPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  await requireAdmin();
  const [{ item }, catalog, inputs, recipes] = await Promise.all([searchParams, getCatalog(), getCostInputs(), getRecipes()]);
  return <CostosClient initialCatalog={catalog} initialInputs={inputs} recipes={recipes} initialItemId={item ?? null} />;
}
