"use server";

import { requireModule } from "@/lib/auth/dal";
import * as payroll from "@/services/payroll";
import * as contractors from "@/services/contractors";
import { computeContractorsDashboard } from "@/lib/contractors/dashboard";

// El dashboard junta datos de Planilla y Contratistas: pide los dos módulos.
export async function getAdminDashboardAction(year: number) {
  await requireModule("planilla", "contratistas");
  const [overview, c] = await Promise.all([payroll.getPlanillaOverview(year), contractors.getContractorsDashboardInput()]);
  const prefix = `${year}-`;
  // Saldos de toda la historia: positivo = Ebony le debe al contratista;
  // negativo = se le entregó de más (lo debe él).
  const balances = computeContractorsDashboard(c.contractors, c.entries, new Map(c.projectNames), "all").contractors.map(
    (x) => x.balanceCents
  );
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
    /** Lo que Ebony les debe a los contratistas (saldos a su favor). */
    contractorsOwedCents: balances.reduce((s, b) => s + Math.max(b, 0), 0),
    /** Lo que los contratistas le deben a Ebony (se les entregó de más). */
    contractorsOwingCents: balances.reduce((s, b) => s + Math.max(-b, 0), 0),
  };
}
