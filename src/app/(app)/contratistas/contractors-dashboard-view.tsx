"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, HandCoins, Hammer, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  computeContractorsDashboard,
  type ContractorSummary,
  type DashboardContractor,
  type DashboardEntry,
  type DashboardPeriod,
} from "@/lib/contractors/dashboard";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { PayrollKpiCard } from "@/app/(app)/planilla/payroll-kpi-card";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ContractorAvatar } from "./contractor-avatar";
import { ContractorsMonthlyChart } from "./contractors-monthly-chart";

export interface ContractorsDashboardInput {
  contractors: DashboardContractor[];
  entries: DashboardEntry[];
  projectNames: [string, string][];
}

/** Lista corta con barra: la misma pieza para los dos rankings. */
function RankingCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; name: string; value: number; label: string; hint?: string }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-none border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <Link href={`/contratistas/${r.id}`} className="w-36 shrink-0 truncate text-foreground hover:underline">
                {r.name}
              </Link>
              <div className="h-2 flex-1 bg-muted">
                <div className="h-full bg-[color-mix(in_oklch,var(--payroll-salario)_55%,white)]" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums text-foreground">{r.label}</span>
              {r.hint && <span className="hidden w-28 shrink-0 text-right text-[11px] text-muted-foreground lg:block">{r.hint}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Dashboard de Contratistas: cuánto se les ha entregado (pagos + préstamos)
 * por mes, quién ha recibido más, quién lleva más proyectos, el detalle por
 * contratista con los proyectos que lleva y una comparación aproximada de
 * tiempos y costo por m². El cálculo es puro (`computeContractorsDashboard`)
 * y se rehace en el navegador al cambiar de año.
 */
export function ContractorsDashboardView({ input }: { input: ContractorsDashboardInput }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const years = React.useMemo(
    () => [...new Set(input.entries.map((e) => Number(e.entryDate.slice(0, 4))))].sort((a, b) => b - a),
    [input.entries]
  );
  const thisYear = currentPeriod().year;
  const [period, setPeriod] = React.useState<DashboardPeriod>(() => thisYear);
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const data = React.useMemo(
    () => computeContractorsDashboard(input.contractors, input.entries, new Map(input.projectNames), period),
    [input, period]
  );

  const byDelivered = [...data.contractors].filter((c) => c.deliveredCents > 0).sort((a, b) => b.deliveredCents - a.deliveredCents);
  const byProjects = [...data.contractors].filter((c) => c.projects.length > 0).sort((a, b) => b.projects.length - a.projects.length);
  const bySpeed = data.contractors
    .filter((c) => c.avgDaysPerProject !== null && c.projectsMeasured >= 2)
    .sort((a, b) => (a.avgDaysPerProject as number) - (b.avgDaysPerProject as number));
  const byCost = data.contractors
    .filter((c) => c.costPerMt2Cents !== null)
    .sort((a, b) => (a.costPerMt2Cents as number) - (b.costPerMt2Cents as number));
  const tableRows = [...data.contractors].sort((a, b) => b.deliveredCents - a.deliveredCents || b.billedCents - a.billedCents);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const typeLabel = (c: ContractorSummary) =>
    c.contractor.contractorType === "pintor" ? tt("cd_type_pintor") : tt("cd_type_ebanista");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{tt("cd_title")}</p>
          <p className="text-xs text-muted-foreground">{tt("cd_subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {years.map((y) => (
            <Button key={y} size="sm" variant={period === y ? "secondary" : "ghost"} onClick={() => setPeriod(y)}>
              {y}
            </Button>
          ))}
          <Button size="sm" variant={period === "all" ? "secondary" : "ghost"} onClick={() => setPeriod("all")}>
            {tt("cd_all")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PayrollKpiCard
          icon={Wallet}
          label={tt("cd_kpi_delivered")}
          value={formatCents(data.totals.deliveredCents)}
          sublabel={`${formatCents(data.totals.paidCents)} ${tt("cd_series_paid").toLowerCase()} · ${formatCents(data.totals.loansCents)} ${tt("cd_series_loans").toLowerCase()}`}
        />
        <PayrollKpiCard icon={Hammer} label={tt("cd_kpi_billed")} value={formatCents(data.totals.billedCents)} />
        <PayrollKpiCard
          icon={HandCoins}
          label={tt("cd_kpi_owed")}
          value={formatCents(data.totals.owedCents)}
          sublabel={tt("cd_kpi_owed_sub")}
        />
        <PayrollKpiCard
          icon={Users}
          label={tt("cd_kpi_active")}
          value={String(data.totals.activeContractors)}
          sublabel={`${data.totals.projects} ${tt("cd_kpi_projects")}`}
        />
      </div>

      <ContractorsMonthlyChart months={data.monthly} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RankingCard
          title={tt("cd_rank_paid")}
          empty={tt("cd_rank_empty")}
          rows={byDelivered.slice(0, 8).map((c) => ({
            id: c.contractor.id,
            name: c.contractor.name,
            value: c.deliveredCents,
            label: formatCents(c.deliveredCents),
          }))}
        />
        <RankingCard
          title={tt("cd_rank_projects")}
          empty={tt("cd_rank_empty")}
          rows={byProjects.slice(0, 8).map((c) => ({
            id: c.contractor.id,
            name: c.contractor.name,
            value: c.projects.length,
            label: `${c.projects.length} ${tt("cd_projects_unit")}`,
          }))}
        />
      </div>

      {/* Detalle por contratista, con los proyectos que lleva cada uno. */}
      <div className="rounded-none border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{tt("cd_table_title")}</p>
          <p className="text-xs text-muted-foreground">{tt("cd_table_hint")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">{tt("cd_col_contractor")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_projects")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_billed")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_paid")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_loans")}</th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_material")}</th>
                <th className="px-2 py-2 text-right font-medium" title={tt("cd_balance_hint")}>
                  {tt("cd_col_balance")}
                </th>
                <th className="px-2 py-2 text-right font-medium">{tt("cd_col_last")}</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((c) => {
                const isOpen = open.has(c.contractor.id);
                return (
                  <React.Fragment key={c.contractor.id}>
                    <tr
                      className="cursor-pointer border-b border-border hover:bg-muted/40"
                      onClick={() => toggle(c.contractor.id)}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                          />
                          <ContractorAvatar name={c.contractor.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/contratistas/${c.contractor.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="whitespace-nowrap font-medium text-foreground hover:underline"
                            >
                              {c.contractor.name}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">{typeLabel(c)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.projects.length || "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.billedCents ? formatCents(c.billedCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.paidCents ? formatCents(c.paidCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.loansCents ? formatCents(c.loansCents) : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.materialCents ? formatCents(c.materialCents) : "–"}</td>
                      <td
                        className={`px-2 py-2 text-right font-medium tabular-nums ${c.balanceCents < 0 ? "text-destructive" : "text-foreground"}`}
                      >
                        {formatCents(c.balanceCents)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                        {c.lastEntryDate ? formatDate(lang, c.lastEntryDate) : "–"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={8} className="px-2 py-3 pl-12">
                          {c.projects.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{tt("cd_proj_none")}</p>
                          ) : (
                            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                              {c.projects.map((p) => (
                                <li key={p.key} className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-foreground">{p.name}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatCents(p.billedCents)}
                                    {p.days > 0 ? ` · ${p.days} ${tt("cd_proj_days")}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparaciones aproximadas: tiempo por proyecto y costo por m². */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-4">
          <p className="mb-1 text-sm font-medium text-foreground">{tt("cd_speed_title")}</p>
          <p className="mb-3 text-[11px] leading-snug text-muted-foreground">{tt("cd_speed_note")}</p>
          {bySpeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt("cd_speed_empty")}</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {bySpeed.map((c, i) => (
                <li key={c.contractor.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-foreground">{c.contractor.name}</span>
                  <span className="tabular-nums text-foreground">
                    {Math.round(c.avgDaysPerProject as number)} {tt("cd_days_avg")}
                  </span>
                  <span className="w-20 text-right text-[11px] text-muted-foreground">
                    {c.projectsMeasured} {tt("cd_projects_unit")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-none border border-border bg-card p-4">
          <p className="mb-1 text-sm font-medium text-foreground">{tt("cd_cost_title")}</p>
          <p className="mb-3 text-[11px] leading-snug text-muted-foreground">{tt("cd_cost_note")}</p>
          {byCost.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt("cd_rank_empty")}</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {byCost.map((c, i) => (
                <li key={c.contractor.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-foreground">{c.contractor.name}</span>
                  <span className="tabular-nums text-foreground">{formatCents(c.costPerMt2Cents as number)}/m²</span>
                  <span className="w-20 text-right text-[11px] text-muted-foreground">{Math.round(c.mt2)} m²</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
