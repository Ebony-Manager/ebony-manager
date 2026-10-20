import { requireModule } from "@/lib/auth/dal";
import { AdminDashboardView } from "./admin-dashboard-view";

// Dashboard global de Administración (Planilla + Contratistas): pide los dos módulos,
// y nunca cacheado porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function AdministracionPage() {
  await requireModule("planilla", "contratistas");
  return <AdminDashboardView />;
}
