import { requireModule } from "@/lib/auth/dal";
import { AdminDashboardView } from "./admin-dashboard-view";

// Personal → Resumen: lo pagado por mes entre Planilla y Contratistas. Pide
// los dos módulos, y nunca cacheado porque los datos cambian por acción del usuario.
export const dynamic = "force-dynamic";

export default async function PersonalResumenPage() {
  await requireModule("planilla", "contratistas");
  return <AdminDashboardView />;
}
