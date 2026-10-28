import { notFound } from "next/navigation";

import { requireModule } from "@/lib/auth/dal";
import { hasModule } from "@/lib/auth/modules";
import { getStaffPerson } from "@/services/staff-directory";
import { StaffReadOnlyProfile } from "../../staff-readonly-profile";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { getEmployeePhotoUrls, getPayrollEmployee } from "@/services/payroll-employees";
import { signedDocumentUrl } from "@/services/photos";
import { getPayrollPositions } from "@/services/payroll-positions";
import { getSalaryChanges } from "@/services/payroll-salary";
import { getEmployeeAnnualDetail, getLedgerEntries, getLoansForEmployee } from "@/services/payroll";
import { parseEmployeeFrom } from "@/lib/personal/paths";
import { EmployeeProfileView } from "@/app/(app)/planilla/employee-profile-view";

// Ficha del empleado, dentro de Personal → Staff. Entra quien tiene el
// permiso Personal; la ficha completa (sueldo, estado de cuenta, préstamos)
// pide además `planilla` — sin él se muestra la ficha sin dinero, que sale de
// `staff_people()`. La RLS de `payroll_employees` es la última línea. `force-dynamic`
// porque los datos cambian por acción del usuario y no deben cachearse.
export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const profile = await requireModule("documentos");
  const { id } = await params;
  if (!hasModule(profile, "planilla")) {
    const person = await getStaffPerson("employee", id);
    if (!person) notFound();
    return <StaffReadOnlyProfile person={person} />;
  }
  const { from } = await searchParams;
  const year = currentPeriod().year;

  // Todo lo que pinta el perfil se pide EN PARALELO desde el servidor (un
  // solo viaje de espera), en vez de que cada sección lo pida por su cuenta
  // después de pintarse, una detrás de otra.
  const [employee, positions, detail, ledger, salaryChanges, loans] = await Promise.all([
    getPayrollEmployee(id),
    getPayrollPositions(),
    getEmployeeAnnualDetail(id, year),
    getLedgerEntries(id),
    getSalaryChanges(id),
    getLoansForEmployee(id),
  ]);
  if (!employee) notFound();

  const [photoUrls, documentUrl] = await Promise.all([
    getEmployeePhotoUrls([employee]),
    signedDocumentUrl(employee.idDocumentPath),
  ]);

  return (
    <EmployeeProfileView
      employee={employee}
      positions={positions}
      photoUrl={photoUrls[employee.id] ?? null}
      documentUrl={documentUrl}
      from={parseEmployeeFrom(from)}
      initial={{ detail: { year, rows: detail }, ledger, salaryChanges }}
      loans={loans}
    />
  );
}
