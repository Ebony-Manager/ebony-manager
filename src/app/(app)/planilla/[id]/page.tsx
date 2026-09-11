import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { getPayrollEmployee } from "@/services/payroll-employees";
import { EmployeeProfileView } from "../employee-profile-view";

// El perfil del empleado es solo-admin, igual que el resto de Planilla:
// `requireAdmin()` rebota a un no-admin antes de cargar nada y la RLS
// admin-only de `payroll_employees` es la última línea. `force-dynamic`
// porque los datos cambian por acción del usuario y no deben cachearse.
export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const employee = await getPayrollEmployee(id);
  if (!employee) notFound();

  return <EmployeeProfileView employee={employee} />;
}
