"use server";

import { requireAdmin } from "@/lib/auth/dal";
import * as payroll from "@/services/payroll";
import * as contractors from "@/services/contractors";

// Solo-admin, como Planilla y Contratistas: el dashboard junta datos de las dos.
export async function getAdminDashboardAction(year: number) {
  await requireAdmin();
  const [overview, c] = await Promise.all([payroll.getPlanillaOverview(year), contractors.getContractorsDashboardInput()]);
  const prefix = `${year}-`;
  return {
    year,
    planilla: overview.rows.map((r) => ({
      id: r.employee.id,
      name: r.employee.name,
      categoria: r.employee.categoria,
      totalsByPeriod: r.totalsByPeriod,
    })),
    contractors: c.contractors.map((x) => ({ id: x.id, name: x.name })),
    entries: c.entries
      .filter((e) => e.entryDate.startsWith(prefix))
      .map((e) => ({
        contractorId: e.contractorId,
        entryDate: e.entryDate,
        category: e.category,
        amountCents: e.amountCents,
        projectId: e.projectId,
        clientText: e.clientText,
      })),
    projectNames: c.projectNames,
    /** Lo que los empleados deben a la empresa (préstamos por cobrar). */
    loansReceivableCents: Object.values(overview.balances).reduce((s, b) => s + Math.max(b, 0), 0),
  };
}
