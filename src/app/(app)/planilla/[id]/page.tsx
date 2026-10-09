import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { getEmployeePhotoUrls, getPayrollEmployee } from "@/services/payroll-employees";
import { getPayrollPositions } from "@/services/payroll-positions";
import { getSalaryChanges } from "@/services/payroll-salary";
import { getEmployeeAnnualDetail, getLedgerEntries } from "@/services/payroll";
import { EmployeeProfileView } from "../employee-profile-view";

// El perfil del empleado es solo-admin, igual que el resto de Planilla:
// `requireAdmin()` rebota a un no-admin antes de cargar nada y la RLS
// admin-only de `payroll_employees` es la última línea. `force-dynamic`
// porque los datos cambian por acción del usuario y no deben cachearse.
export const dynamic = "force-dynamic";

const FROM_TABS = ["dashboard", "registro", "auditoria", "empleados"] as const;

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { from } = await searchParams;
  const backTo = FROM_TABS.find((t) => t === from) ?? "empleados";
  const year = currentPeriod().year;

  // Todo lo que pinta el perfil se pide EN PARALELO desde el servidor (un
  // solo viaje de espera), en vez de que cada sección lo pida por su cuenta
  // después de pintarse, una detrás de otra.
  const [employee, positions, detail, ledger, salaryChanges] = await Promise.all([
    getPayrollEmployee(id),
    getPayrollPositions(),
    getEmployeeAnnualDetail(id, year),
    getLedgerEntries(id),
    getSalaryChanges(id),
  ]);
  if (!employee) notFound();

  const photoUrls = await getEmployeePhotoUrls([employee]);

  return (
    <EmployeeProfileView
      employee={employee}
      positions={positions}
      photoUrl={photoUrls[employee.id] ?? null}
      from={backTo}
      initial={{ detail: { year, rows: detail }, ledger, salaryChanges }}
    />
  );
}
