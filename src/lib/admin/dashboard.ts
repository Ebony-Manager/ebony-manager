/**
 * Cálculos PUROS de Personal → Resumen: lo que se paga cada
 * mes juntando la Planilla (Taller + Administrativos) y los Contratistas
 * (pintura va dentro de contratistas).
 *
 * Definiciones (se muestran igual en la pantalla):
 *  - Planilla  = el total de cada quincena de cada empleado (lo que se le paga:
 *                salario, extras, prestaciones pagadas, menos descuentos y
 *                abonos de préstamo), sumado por mes y por tipo de empleado.
 *  - Contratistas = abonos ("pago") del estado de cuenta de cada contratista,
 *                por la fecha del abono.
 *  - Proyectos trabajados = proyectos distintos con movimientos de trabajo de
 *                contratistas ese mes (si un movimiento no tiene proyecto, el
 *                cliente tal como se escribió, normalizado).
 */

export interface AdminPlanillaRow {
  id: string;
  name: string;
  categoria: "taller" | "administrativo";
  /** "month-half" -> centavos. */
  totalsByPeriod: Record<string, number>;
}

export interface AdminContractor {
  id: string;
  name: string;
}

export interface AdminContractorEntry {
  contractorId: string;
  /** `YYYY-MM-DD`. */
  entryDate: string;
  category: string;
  amountCents: number;
  projectId: string | null;
  clientText: string | null;
}

export interface AdminMonth {
  month: number;
  tallerCents: number;
  adminCents: number;
  contractorsCents: number;
  totalCents: number;
  /** Proyectos distintos trabajados por contratistas ese mes. */
  projects: number;
  employeesPaid: number;
  contractorsPaid: number;
  /** ¿Ya empezó ese mes? (los futuros se ven atenuados). */
  occurred: boolean;
}

export interface AdminRankItem {
  id: string;
  name: string;
  cents: number;
  /** Solo empleados. */
  categoria?: "taller" | "administrativo";
}

export interface AdminDashboard {
  year: number;
  months: AdminMonth[];
  /** Acumulado del año hasta el último mes ocurrido. */
  ytd: { tallerCents: number; adminCents: number; contractorsCents: number; totalCents: number };
  /** Top por mes (índice 0 = enero) y del año (hasta hoy). */
  topEmployeesByMonth: AdminRankItem[][];
  topEmployeesYear: AdminRankItem[];
  topContractorsByMonth: AdminRankItem[][];
  topContractorsYear: AdminRankItem[];
  /** Proyectos del mes: nombre + cuántos movimientos de trabajo (para listar). */
  projectsByMonth: { name: string; entries: number }[][];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const TOP = 5;

function top(map: Map<string, AdminRankItem>): AdminRankItem[] {
  return [...map.values()].filter((x) => x.cents > 0).sort((a, b) => b.cents - a.cents).slice(0, TOP);
}

export function computeAdminDashboard(input: {
  year: number;
  /** Mes (1-12) hasta el que algo "ya ocurrió" en este año: 12 si el año ya pasó, 0 si es futuro. */
  lastOccurredMonth: number;
  planilla: readonly AdminPlanillaRow[];
  contractors: readonly AdminContractor[];
  entries: readonly AdminContractorEntry[];
  projectNames: ReadonlyMap<string, string>;
}): AdminDashboard {
  const { year, lastOccurredMonth, planilla, contractors, entries, projectNames } = input;
  const contractorName = new Map(contractors.map((c) => [c.id, c.name]));

  const months: AdminMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    tallerCents: 0,
    adminCents: 0,
    contractorsCents: 0,
    totalCents: 0,
    projects: 0,
    employeesPaid: 0,
    contractorsPaid: 0,
    occurred: i + 1 <= lastOccurredMonth,
  }));

  const empByMonth: Map<string, AdminRankItem>[] = months.map(() => new Map());
  const empYear = new Map<string, AdminRankItem>();
  for (const row of planilla) {
    for (let m = 1; m <= 12; m++) {
      const cents = (row.totalsByPeriod[`${m}-1`] ?? 0) + (row.totalsByPeriod[`${m}-2`] ?? 0);
      if (cents === 0) continue;
      const month = months[m - 1];
      if (row.categoria === "administrativo") month.adminCents += cents;
      else month.tallerCents += cents;
      if (cents > 0) month.employeesPaid += 1;
      const item = { id: row.id, name: row.name, categoria: row.categoria };
      const cur = empByMonth[m - 1].get(row.id) ?? { ...item, cents: 0 };
      cur.cents += cents;
      empByMonth[m - 1].set(row.id, cur);
      if (m <= lastOccurredMonth) {
        const y = empYear.get(row.id) ?? { ...item, cents: 0 };
        y.cents += cents;
        empYear.set(row.id, y);
      }
    }
  }

  const conByMonth: Map<string, AdminRankItem>[] = months.map(() => new Map());
  const conYear = new Map<string, AdminRankItem>();
  const projByMonth: Map<string, { name: string; entries: number }>[] = months.map(() => new Map());
  for (const e of entries) {
    if (Number(e.entryDate.slice(0, 4)) !== year) continue;
    const m = Number(e.entryDate.slice(5, 7));
    if (!(m >= 1 && m <= 12)) continue;
    if (e.category === "pago") {
      months[m - 1].contractorsCents += e.amountCents;
      const base = { id: e.contractorId, name: contractorName.get(e.contractorId) ?? "—" };
      const cur = conByMonth[m - 1].get(e.contractorId) ?? { ...base, cents: 0 };
      cur.cents += e.amountCents;
      conByMonth[m - 1].set(e.contractorId, cur);
      if (m <= lastOccurredMonth) {
        const y = conYear.get(e.contractorId) ?? { ...base, cents: 0 };
        y.cents += e.amountCents;
        conYear.set(e.contractorId, y);
      }
    } else if (e.category === "trabajo") {
      const name = (e.projectId ? (projectNames.get(e.projectId) ?? e.clientText ?? "") : (e.clientText ?? ""))
        .replace(/\s+/g, " ")
        .trim();
      const key = e.projectId ?? norm(name);
      if (!key) continue;
      const cur = projByMonth[m - 1].get(key) ?? { name: name || "—", entries: 0 };
      cur.entries += 1;
      projByMonth[m - 1].set(key, cur);
    }
  }

  const projectsByMonth = projByMonth.map((map) => [...map.values()].sort((a, b) => b.entries - a.entries));
  for (let i = 0; i < 12; i++) {
    months[i].totalCents = months[i].tallerCents + months[i].adminCents + months[i].contractorsCents;
    months[i].projects = projectsByMonth[i].length;
    months[i].contractorsPaid = conByMonth[i].size;
  }

  const upTo = months.filter((m) => m.occurred);
  const sum = (pick: (m: AdminMonth) => number) => upTo.reduce((s, m) => s + pick(m), 0);
  return {
    year,
    months,
    ytd: {
      tallerCents: sum((m) => m.tallerCents),
      adminCents: sum((m) => m.adminCents),
      contractorsCents: sum((m) => m.contractorsCents),
      totalCents: sum((m) => m.totalCents),
    },
    topEmployeesByMonth: empByMonth.map(top),
    topEmployeesYear: top(empYear),
    topContractorsByMonth: conByMonth.map(top),
    topContractorsYear: top(conYear),
    projectsByMonth,
  };
}
