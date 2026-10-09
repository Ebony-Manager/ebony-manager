/**
 * Cálculos PUROS del dashboard de Contratistas (sin red): resumen por
 * contratista, pagado por mes y rankings. El servicio entrega los
 * movimientos y esto arma todo.
 *
 * Definiciones (se muestran igual en la pantalla):
 *  - Facturado  = trabajo + bonos + extras (lo que Ebony le reconoce).
 *  - Pagado     = abonos (categoría "pago").
 *  - Préstamos  = préstamos + adelantos (plata entregada por adelantado).
 *  - "Total entregado" = Pagado + Préstamos: todo el dinero que salió hacia
 *    el contratista.
 *  - Material   = compras de material descontadas (las que Ebony asume no
 *    cuentan).
 *  - Saldo      = el de siempre (ver contractor-ledger.ts), de TODA la historia.
 *  - Proyecto   = el proyecto enlazado; si el movimiento no tiene proyecto,
 *    el nombre del cliente tal como se escribió (normalizado para agrupar).
 *
 * "Días por proyecto" es APROXIMADO: días entre el primer y el último
 * movimiento de trabajo de ese proyecto. La app no guarda fecha de inicio ni
 * de entrega por contratista, así que esto solo es un indicio.
 */
import type { ContractorLedgerCategory, ContractorType } from "@/types/contractors";

export interface DashboardContractor {
  id: string;
  name: string;
  contractorType: ContractorType;
  status: "ACTIVE" | "INACTIVE" | string;
}

export interface DashboardEntry {
  contractorId: string;
  /** `YYYY-MM-DD`. */
  entryDate: string;
  category: ContractorLedgerCategory;
  direction: "a_favor" | "reduce";
  amountCents: number;
  projectId: string | null;
  clientText: string | null;
  mt2: number | null;
  ebonyAbsorbsMaterial: boolean;
}

export type DashboardPeriod = number | "all";

export interface DashboardProject {
  key: string;
  name: string;
  billedCents: number;
  firstDate: string;
  lastDate: string;
  /** Días entre el primer y el último movimiento de trabajo (aprox.). */
  days: number;
}

export interface ContractorSummary {
  contractor: DashboardContractor;
  billedCents: number;
  paidCents: number;
  loansCents: number;
  /** Pagado + préstamos. */
  deliveredCents: number;
  materialCents: number;
  mt2: number;
  /** Costo promedio por m² (solo con m² registrados), en centavos. */
  costPerMt2Cents: number | null;
  projects: DashboardProject[];
  /** Promedio de días por proyecto (solo proyectos con 2+ fechas distintas). */
  avgDaysPerProject: number | null;
  /** Cuántos proyectos entraron en ese promedio. */
  projectsMeasured: number;
  /** Saldo de toda la historia (> 0: Ebony le debe). */
  balanceCents: number;
  lastEntryDate: string | null;
}

export interface MonthPoint {
  /** `YYYY-MM`. */
  key: string;
  paidCents: number;
  loansCents: number;
  billedCents: number;
}

export interface ContractorsDashboard {
  period: DashboardPeriod;
  contractors: ContractorSummary[];
  monthly: MonthPoint[];
  totals: {
    contractors: number;
    activeContractors: number;
    billedCents: number;
    paidCents: number;
    loansCents: number;
    deliveredCents: number;
    materialCents: number;
    /** Suma de saldos positivos: lo que Ebony debe. */
    owedCents: number;
    projects: number;
  };
}

const WORK: ContractorLedgerCategory[] = ["trabajo", "bono", "extra"];
const LOAN: ContractorLedgerCategory[] = ["prestamo", "adelanto"];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const inPeriod = (date: string, period: DashboardPeriod) => period === "all" || Number(date.slice(0, 4)) === period;

/** Saldo de una lista de movimientos (misma regla que contractor-ledger.ts). */
function balanceOf(entries: readonly DashboardEntry[]): number {
  return entries.reduce((s, e) => {
    if (e.category === "material" && e.ebonyAbsorbsMaterial) return s;
    return s + (e.direction === "a_favor" ? e.amountCents : -e.amountCents);
  }, 0);
}

export function computeContractorsDashboard(
  contractors: readonly DashboardContractor[],
  entries: readonly DashboardEntry[],
  projectNames: ReadonlyMap<string, string>,
  period: DashboardPeriod
): ContractorsDashboard {
  const byContractor = new Map<string, DashboardEntry[]>();
  for (const e of entries) {
    const list = byContractor.get(e.contractorId) ?? [];
    list.push(e);
    byContractor.set(e.contractorId, list);
  }

  const summaries: ContractorSummary[] = contractors.map((c) => {
    const all = byContractor.get(c.id) ?? [];
    const own = all.filter((e) => inPeriod(e.entryDate, period));

    let billed = 0, paid = 0, loans = 0, material = 0, mt2 = 0, mt2Billed = 0;
    const projects = new Map<string, DashboardProject>();
    for (const e of own) {
      if (WORK.includes(e.category) && e.direction === "a_favor") {
        billed += e.amountCents;
        if (e.category === "trabajo") {
          if (e.mt2 && e.mt2 > 0) { mt2 += e.mt2; mt2Billed += e.amountCents; }
          const raw = e.projectId ? (projectNames.get(e.projectId) ?? e.clientText ?? "") : (e.clientText ?? "");
          const name = raw.trim();
          if (name) {
            const key = e.projectId ? `p:${e.projectId}` : `t:${norm(name)}`;
            const p = projects.get(key) ?? { key, name, billedCents: 0, firstDate: e.entryDate, lastDate: e.entryDate, days: 0 };
            p.billedCents += e.amountCents;
            if (e.entryDate < p.firstDate) p.firstDate = e.entryDate;
            if (e.entryDate > p.lastDate) p.lastDate = e.entryDate;
            projects.set(key, p);
          }
        }
      } else if (e.category === "pago") paid += e.amountCents;
      else if (LOAN.includes(e.category)) loans += e.amountCents;
      else if (e.category === "material" && !e.ebonyAbsorbsMaterial) material += e.amountCents;
    }
    const projectList = [...projects.values()].map((p) => ({ ...p, days: dayNumber(p.lastDate) - dayNumber(p.firstDate) }));
    const measured = projectList.filter((p) => p.days > 0);
    const dates = all.map((e) => e.entryDate).sort();
    return {
      contractor: c,
      billedCents: billed,
      paidCents: paid,
      loansCents: loans,
      deliveredCents: paid + loans,
      materialCents: material,
      mt2,
      costPerMt2Cents: mt2 > 0 ? Math.round(mt2Billed / mt2) : null,
      projects: projectList.sort((a, b) => b.billedCents - a.billedCents),
      avgDaysPerProject: measured.length > 0 ? measured.reduce((s, p) => s + p.days, 0) / measured.length : null,
      projectsMeasured: measured.length,
      balanceCents: balanceOf(all),
      lastEntryDate: dates.length > 0 ? dates[dates.length - 1] : null,
    };
  });

  // Serie mensual de TODOS los contratistas juntos.
  const inScope = entries.filter((e) => inPeriod(e.entryDate, period));
  const months = new Map<string, MonthPoint>();
  const ensure = (key: string) => {
    const m = months.get(key) ?? { key, paidCents: 0, loansCents: 0, billedCents: 0 };
    months.set(key, m);
    return m;
  };
  if (period !== "all") for (let m = 1; m <= 12; m++) ensure(`${period}-${String(m).padStart(2, "0")}`);
  for (const e of inScope) {
    const m = ensure(e.entryDate.slice(0, 7));
    if (WORK.includes(e.category) && e.direction === "a_favor") m.billedCents += e.amountCents;
    else if (e.category === "pago") m.paidCents += e.amountCents;
    else if (LOAN.includes(e.category)) m.loansCents += e.amountCents;
  }
  let monthly = [...months.values()].sort((a, b) => a.key.localeCompare(b.key));
  if (period === "all" && monthly.length > 1) {
    // Rellena los meses sin movimientos entre el primero y el último.
    const filled: MonthPoint[] = [];
    let [y, mo] = monthly[0].key.split("-").map(Number);
    const [ly, lm] = monthly[monthly.length - 1].key.split("-").map(Number);
    while (y < ly || (y === ly && mo <= lm)) {
      const key = `${y}-${String(mo).padStart(2, "0")}`;
      filled.push(months.get(key) ?? { key, paidCents: 0, loansCents: 0, billedCents: 0 });
      mo++; if (mo > 12) { mo = 1; y++; }
    }
    monthly = filled;
  }

  const distinctProjects = new Set<string>();
  for (const s of summaries) for (const p of s.projects) distinctProjects.add(p.key);

  return {
    period,
    contractors: summaries,
    monthly,
    totals: {
      contractors: contractors.length,
      activeContractors: contractors.filter((c) => c.status === "ACTIVE").length,
      billedCents: summaries.reduce((s, c) => s + c.billedCents, 0),
      paidCents: summaries.reduce((s, c) => s + c.paidCents, 0),
      loansCents: summaries.reduce((s, c) => s + c.loansCents, 0),
      deliveredCents: summaries.reduce((s, c) => s + c.deliveredCents, 0),
      materialCents: summaries.reduce((s, c) => s + c.materialCents, 0),
      owedCents: summaries.reduce((s, c) => s + Math.max(c.balanceCents, 0), 0),
      projects: distinctProjects.size,
    },
  };
}
