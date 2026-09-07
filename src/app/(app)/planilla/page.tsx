import { requireAdmin } from "@/lib/auth/dal";
import { getPayrollEmployees } from "@/services/payroll-employees";
import { PlanillaClient } from "./planilla-client";

// La Planilla es solo-admin. `requireAdmin()` rebota a un no-admin (a
// /cotizacion) antes de cargar nada; la RLS admin-only de las tablas es
// la última línea. `force-dynamic` porque los datos cambian por acción
// del usuario y no deben cachearse entre requests.
export const dynamic = "force-dynamic";

export default async function PlanillaPage() {
  await requireAdmin();
  const employees = await getPayrollEmployees();

  return <PlanillaClient employees={employees} />;
}
