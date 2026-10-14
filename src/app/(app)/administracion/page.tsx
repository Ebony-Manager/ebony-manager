import { requireAdmin } from "@/lib/auth/dal";
import { AdminDashboardView } from "./admin-dashboard-view";

// Dashboard global de Administración (Planilla + Contratistas): solo-admin,
// y nunca cacheado porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function AdministracionPage() {
  await requireAdmin();
  return <AdminDashboardView />;
}
