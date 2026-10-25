import { requireProfile } from "@/lib/auth/dal";
import { hasAnyModule, hasModule } from "@/lib/auth/modules";
import { computeAdminDashboard } from "@/lib/admin/dashboard";
import { computeContractorsDashboard } from "@/lib/contractors/dashboard";
import { summarizeConsumption } from "@/lib/almacen/summary";
import { summarizeAttendance } from "@/lib/planilla/attendance-summary";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { projectsForMonth, quotesForMonth, stockSnapshot } from "@/lib/dashboard/company";
import { getQuoteSummaries } from "@/services/cotizador";
import { getContractorsDashboardInput, getProjects } from "@/services/contractors";
import { getAttendanceSummary, getPlanillaOverview } from "@/services/payroll";
import { getCatalog, getMovements } from "@/services/almacen";
import { CompanyDashboardView, type CompanyDashboardData } from "./company-dashboard-view";

// Dashboard de empresa: una sección por módulo que el usuario puede ver
// (Cotizaciones, Proyectos, Personal, Almacén), con los números del mes y
// un enlace al resumen de cada sección. El mes va en la URL (`?mes=AAAA-MM`).
export const dynamic = "force-dynamic";

function parseMonth(value: string | undefined): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  const now = currentPeriod();
  if (!m) return { year: now.year, month: now.month };
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : { year: now.year, month: now.month };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const profile = await requireProfile();
  const { year, month } = parseMonth((await searchParams).mes);
  const can = {
    quotes: hasModule(profile, "cotizacion"),
    projects: hasAnyModule(profile, ["proyectos", "contratistas"]),
    planilla: hasModule(profile, "planilla"),
    contractors: hasModule(profile, "contratistas"),
    almacen: hasModule(profile, "almacen"),
    // Costos del almacén (valor del inventario): solo Compras o Costos.
    almacenCosts: hasAnyModule(profile, ["almacen_compras", "almacen_costos"]),
  };
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  const [quotes, projects, overview, attendance, contractors, items, movements] = await Promise.all([
    can.quotes ? getQuoteSummaries() : null,
    can.projects ? getProjects() : null,
    can.planilla ? getPlanillaOverview(year) : null,
    can.planilla ? getAttendanceSummary(year) : null,
    can.contractors ? getContractorsDashboardInput() : null,
    can.almacen ? getCatalog() : null,
    can.almacen ? getMovements(20000, monthStart) : null,
  ]);

  let personal: CompanyDashboardData["personal"] = null;
  if (overview || contractors) {
    const now = currentPeriod();
    const dash = computeAdminDashboard({
      year,
      lastOccurredMonth: year < now.year ? 12 : year > now.year ? 0 : now.month,
      planilla: (overview?.rows ?? []).map((r) => ({
        id: r.employee.id,
        name: r.employee.name,
        categoria: r.employee.categoria,
        totalsByPeriod: r.totalsByPeriod,
      })),
      contractors: (contractors?.contractors ?? []).map((c) => ({ id: c.id, name: c.name })),
      entries: (contractors?.entries ?? []).filter((e) => e.entryDate.startsWith(`${year}-`)),
      projectNames: new Map(contractors?.projectNames ?? []),
    });
    const m = dash.months[month - 1];
    const att = attendance ? summarizeAttendance(attendance.employees, attendance.rows, month) : null;
    const balances = contractors
      ? computeContractorsDashboard(contractors.contractors, contractors.entries, new Map(contractors.projectNames), "all").contractors.map((c) => c.balanceCents)
      : null;
    personal = {
      totalCents: m.totalCents,
      prevTotalCents: month > 1 ? dash.months[month - 2].totalCents : null,
      payrollCents: overview ? m.tallerCents + m.adminCents : null,
      contractorsCents: contractors ? m.contractorsCents : null,
      peoplePaid: m.employeesPaid + m.contractorsPaid,
      attendance: att && {
        days: att.days,
        hours: att.hours,
        cents: att.cents,
        absentPeople: att.byAbsences.length,
        latePeople: att.byLateness.length,
      },
      loansReceivableCents: overview ? Object.values(overview.balances).reduce((s, b) => s + Math.max(b, 0), 0) : null,
      contractorsOwedCents: balances ? balances.reduce((s, b) => s + Math.max(b, 0), 0) : null,
    };
  }

  let almacen: CompanyDashboardData["almacen"] = null;
  if (items && movements) {
    const cur = summarizeConsumption(movements, items, { year, month });
    almacen = { stock: stockSnapshot(items), issues: cur.issues, products: cur.products, canCosts: can.almacenCosts };
  }

  return (
    <CompanyDashboardView
      data={{
        year,
        month,
        quotes: quotes && quotesForMonth(quotes, year, month),
        projects: projects && projectsForMonth(projects, year, month),
        personal,
        almacen,
      }}
    />
  );
}
