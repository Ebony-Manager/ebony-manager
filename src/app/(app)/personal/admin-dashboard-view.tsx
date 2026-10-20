"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CalendarClock, ChevronLeft, ChevronRight, FolderKanban, HandCoins, Hammer, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeAdminDashboard, type AdminRankItem } from "@/lib/admin/dashboard";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { PayrollKpiCard } from "@/app/(app)/planilla/payroll-kpi-card";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getAdminDashboardAction } from "./actions";
import { ADMIN_SERIES, AdminMonthlyChart, type AdminSeriesKey } from "./admin-monthly-chart";

type Data = Awaited<ReturnType<typeof getAdminDashboardAction>>;
type RankScope = "month" | "year";

/**
 * Personal → Resumen: lo que se paga cada mes juntando la
 * Planilla (Taller + Administrativos) y los Contratistas (la pintura va dentro
 * de contratistas). Barras apiladas por mes, KPIs del mes elegido con su
 * comparación contra el mes anterior, reparto por categoría, proyectos
 * trabajados y rankings de quién cobra más.
 */
export function AdminDashboardView() {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.adminDash) => t(lang, strings.adminDash[k]);
  const now = React.useMemo(() => currentPeriod(), []);

  const [year, setYear] = React.useState(now.year);
  const [month, setMonth] = React.useState(now.month);
  const [data, setData] = React.useState<Data | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [scope, setScope] = React.useState<RankScope>("month");

  React.useEffect(() => {
    let cancelled = false;
    getAdminDashboardAction(year)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setFailed(false);
        }
      })
      .catch((err) => {
        console.error("Personal: no se pudo cargar el resumen", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year, attempt]);

  const dash = React.useMemo(() => {
    if (!data || data.year !== year) return null;
    const lastOccurredMonth = year < now.year ? 12 : year > now.year ? 0 : now.month;
    return computeAdminDashboard({
      year,
      lastOccurredMonth,
      planilla: data.planilla,
      contractors: data.contractors,
      entries: data.entries,
      projectNames: new Map(data.projectNames),
    });
  }, [data, year, now]);

  function changeYear(next: number) {
    setYear(next);
    setData(null);
    // Al cambiar de año se cae en el mes actual (o diciembre/enero si no es este año).
    setMonth(next === now.year ? now.month : next < now.year ? 12 : 1);
  }

  const m = dash?.months[month - 1] ?? null;
  const prev = month > 1 ? (dash?.months[month - 2] ?? null) : null;
  const delta = m && prev && prev.totalCents > 0 ? ((m.totalCents - prev.totalCents) / prev.totalCents) * 100 : null;
  const pctOf = (cents: number, total: number) => (total > 0 ? `${((cents / total) * 100).toFixed(0)}%` : "—");

  const employees: AdminRankItem[] = dash ? (scope === "month" ? dash.topEmployeesByMonth[month - 1] : dash.topEmployeesYear) : [];
  const contractors: AdminRankItem[] = dash ? (scope === "month" ? dash.topContractorsByMonth[month - 1] : dash.topContractorsYear) : [];
  const projects = dash?.projectsByMonth[month - 1] ?? [];
  const order: AdminSeriesKey[] = ["admin", "taller", "contractors"];
  const centsOf = (k: AdminSeriesKey) => (!m ? 0 : k === "taller" ? m.tallerCents : k === "admin" ? m.adminCents : m.contractorsCents);

  return (
    <div className="flex flex-col gap-4 px-7 pt-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold text-ink-900">{tt("title")}</h1>
          <p className="text-xs text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border px-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setMonth((x) => Math.max(1, x - 1))} disabled={month === 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-24 text-center text-sm font-medium text-foreground">{monthLabel(lang, month)}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setMonth((x) => Math.min(12, x + 1))} disabled={month === 12}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border px-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => changeYear(year - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-14 text-center text-sm font-medium text-foreground">{year}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => changeYear(year + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {failed ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {tt("load_failed")}
          <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
            {tt("retry")}
          </Button>
        </div>
      ) : !dash || !m || !data ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PayrollKpiCard
              icon={CalendarClock}
              label={`${tt("kpi_total")} · ${monthLabel(lang, month)}`}
              value={formatCents(m.totalCents)}
              sublabel={delta === null ? undefined : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}% ${tt("vs_prev")}`}
            />
            <PayrollKpiCard icon={Users} label={tt("ad_series_taller")} value={formatCents(m.tallerCents)} sublabel={pctOf(m.tallerCents, m.totalCents)} category="salario" />
            <PayrollKpiCard icon={Building2} label={tt("ad_series_admin")} value={formatCents(m.adminCents)} sublabel={pctOf(m.adminCents, m.totalCents)} category="bonos" />
            <PayrollKpiCard icon={Hammer} label={tt("ad_series_contractors")} value={formatCents(m.contractorsCents)} sublabel={pctOf(m.contractorsCents, m.totalCents)} category="decimo" />
            <PayrollKpiCard icon={FolderKanban} label={tt("kpi_projects")} value={String(m.projects)} sublabel={tt("kpi_projects_hint")} />
            <PayrollKpiCard
              icon={Users}
              label={tt("kpi_people_paid")}
              value={String(m.employeesPaid + m.contractorsPaid)}
              sublabel={`${m.employeesPaid} ${tt("employees_word")} · ${m.contractorsPaid} ${tt("contractors_word")}`}
            />
            <PayrollKpiCard icon={Wallet} label={`${tt("kpi_ytd")} ${year}`} value={formatCents(dash.ytd.totalCents)} sublabel={tt("kpi_ytd_hint")} />
            <PayrollKpiCard icon={HandCoins} label={tt("kpi_loans")} value={formatCents(data.loansReceivableCents)} sublabel={tt("kpi_loans_hint")} />
          </div>

          <AdminMonthlyChart months={dash.months} year={year} selectedMonth={month} onSelectMonth={setMonth} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                {tt("split_title")} · {monthLabel(lang, month)}
              </p>
              {m.totalCents === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("tip_empty")}</p>
              ) : (
                <>
                  <div className="flex h-5 w-full overflow-hidden">
                    {order.map((k) => (
                      <div
                        key={k}
                        title={`${tt(ADMIN_SERIES[k].label)} · ${formatCents(centsOf(k))}`}
                        style={{ width: `${(centsOf(k) / m.totalCents) * 100}%`, backgroundColor: ADMIN_SERIES[k].color }}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {order.map((k) => (
                      <li key={k} className="flex items-center gap-2">
                        <span className="size-3 shrink-0" style={{ backgroundColor: ADMIN_SERIES[k].color }} />
                        <span className="flex-1 text-foreground">{tt(ADMIN_SERIES[k].label)}</span>
                        <span className="tabular-nums text-foreground">{formatCents(centsOf(k))}</span>
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pctOf(centsOf(k), m.totalCents)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-5 mb-2 border-t border-border pt-4 text-sm font-medium text-foreground">
                {tt("projects_title")} · {monthLabel(lang, month)}
              </p>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("projects_none")}</p>
              ) : (
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
                  {projects.map((p) => (
                    <li key={p.name} className="flex items-center justify-between gap-3 border-b border-border/60 py-1 last:border-0">
                      <span className="truncate text-foreground">{p.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {p.entries} {tt("movements_word")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{tt("rank_title")}</p>
                <div className="flex items-center gap-1">
                  {(["month", "year"] as const).map((s) => (
                    <Button key={s} size="sm" variant={scope === s ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setScope(s)}>
                      {s === "month" ? monthLabel(lang, month) : `${tt("scope_year")} ${year}`}
                    </Button>
                  ))}
                </div>
              </div>

              <p className="mb-1 text-xs font-medium text-muted-foreground">{tt("rank_employees")}</p>
              <RankList
                items={employees}
                empty={tt("rank_empty")}
                href={(x) => `/planilla/${x.id}`}
                badge={(x) => (x.categoria === "administrativo" ? tt("ad_series_admin") : tt("ad_series_taller"))}
              />

              <p className="mt-5 mb-1 border-t border-border pt-4 text-xs font-medium text-muted-foreground">{tt("rank_contractors")}</p>
              <RankList items={contractors} empty={tt("rank_empty")} href={(x) => `/contratistas/${x.id}`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RankList({
  items,
  empty,
  href,
  badge,
}: {
  items: AdminRankItem[];
  empty: string;
  href: (x: AdminRankItem) => string;
  badge?: (x: AdminRankItem) => string;
}) {
  if (items.length === 0) return <p className="py-1 text-sm text-muted-foreground">{empty}</p>;
  const max = items[0].cents;
  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((x, i) => (
          <tr key={x.id} className="border-b border-border last:border-0">
            <td className="w-6 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</td>
            <td className="py-1.5 pl-2">
              <Link href={href(x)} className="flex items-center gap-2 hover:underline">
                <span className="truncate">{x.name}</span>
                {badge && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {badge(x)}
                  </Badge>
                )}
              </Link>
            </td>
            <td className="hidden w-24 py-1.5 pl-2 sm:table-cell">
              <div className="h-1.5 w-full bg-muted">
                <div className="h-full bg-[var(--walnut)]" style={{ width: `${(x.cents / max) * 100}%` }} />
              </div>
            </td>
            <td className="py-1.5 pl-3 text-right tabular-nums text-foreground">{formatCents(x.cents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
