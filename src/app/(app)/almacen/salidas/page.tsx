import { requireModule } from "@/lib/auth/dal";
import { getCatalog, getCategories, getInventoryPeople, getIssues, getWarehouseProjects } from "@/services/almacen";
import { IssuesView } from "./issues-view";

// Almacén → Salidas: reemplaza al JotForm "Egreso de Suministros". Quién
// entregó es el usuario conectado.
export const dynamic = "force-dynamic";

export default async function SalidasPage() {
  await requireModule("almacen");
  const [issues, items, categories, people, projects] = await Promise.all([
    getIssues(),
    getCatalog(),
    getCategories(),
    getInventoryPeople(),
    getWarehouseProjects(),
  ]);
  return <IssuesView issues={issues} items={items} categories={categories} people={people} projects={projects} />;
}
