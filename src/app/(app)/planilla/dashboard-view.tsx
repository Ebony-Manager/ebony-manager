"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Wallet, CalendarClock, Banknote, Award, TrendingDown, HandCoins, AlertCircle } from "lucide-react";

import type { PayrollEmployeeAnnualSummary, UpcomingObligations } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { periodKey, currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { employeeAccentColor } from "@/lib/planilla/payroll-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getAnnualSummaryAction, getUpcomingObligationsAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";
import { PayrollKpiCard } from "./payroll-kpi-card";
import { MonthlyEvolutionChart } from "./monthly-evolution-chart";
import { ProximasObligacionesCard } from "./proximas-obligaciones-card";

/** Vista ejecutiva — "cómo va tu planilla" sin leer una hoja. Cada
 *  número es un rollup de la misma data que Resumen Anual / Registro.
 *  Portado de Atlas, sin `propertyId`. */
export function DashboardView({ year, onYearChange }: { year: number; onYearChange: (year: number) => void }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [rows, setRows] = React.useState<PayrollEmployeeAnnualSummary[] | null>(null);
  const [obligations, setObligations] = React.useState<UpcomingObligations | null>(null);

  React.useEffect(() => {
    getAnnualSummaryAction(year).then(setRows);
    getUpcomingObligationsAction().then(setObligations);
  }, [year]);

  const loading = !rows || !obligations;

  const active = React.useMemo(() => (rows ?? []).filter((r) => r.employee.status === "ACTIVE"), [rows]);
  const withData = React.useMemo(() => (rows ?? []).filter((r) => r.monthsWithActivity > 0), [rows]);
  const totalYTD = React.useMemo(() => (rows ?? []).reduce((s, r) => s + r.totalPaidCents, 0), [rows]);
  const current = currentPeriod();
  const currentMonthCents = React.useMemo(
    () =>
      (rows ?? []).reduce(
        (s, r) =>
          s + (r.totalsByPeriod[periodKey(current.month, 1)] ?? 0) + (r.totalsByPeriod[periodKey(current.month, 2)] ?? 0),
        0
      ),
    [rows, current.month]
  );
  const salariosCents = React.useMemo(() => (rows ?? []).reduce((s, r) => s + r.conceptTotals.salarioCents, 0), [rows]);
  const prestacionesCents = React.useMemo(
    () =>
      (rows ?? []).reduce(
        (s, r) => s + r.conceptTotals.decimoCents + r.conceptTotals.vacacionCents + r.conceptTotals.primaCents,
        0
      ),
    [rows]
  );
  const descuentosCents = React.useMemo(
    () => (rows ?? []).reduce((s, r) => s + r.conceptTotals.descuentosCents, 0),
    [rows]
  );
  const prestamosCents = React.useMemo(
    () => (rows ?? []).reduce((s, r) => s + r.conceptTotals.prestamosCents, 0),
    [rows]
  );
  const obligacionesPendientesCents = obligations
    ? obligations.decimoPendingCents + obligations.vacacionPendingCents + obligations.prestamosPendingCents
    : 0;

  const maxEmployeeCents = Math.max(...withData.map((r) => r.totalPaidCents), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{tt("tab_dashboard")}</p>
          <p className="text-xs text-muted-foreground">{tt("dashboard_subtitle")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-16 text-center text-sm font-medium text-foreground">{year}</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <PayrollKpiCard
              icon={Wallet}
              label={tt("kpi_total_ytd")}
              value={formatCents(totalYTD)}
              sublabel={`${active.length} ${tt("kpi_active_employees")}`}
              color="var(--payroll-total-due)"
            />
            <PayrollKpiCard
              icon={CalendarClock}
              label={tt("kpi_month_payroll")}
              value={formatCents(currentMonthCents)}
              sublabel={monthLabel(lang, current.month)}
              color="var(--payroll-avg)"
            />
            <PayrollKpiCard icon={Banknote} label={tt("kpi_salaries_total")} value={formatCents(salariosCents)} category="salario" />
            <PayrollKpiCard icon={Award} label={tt("kpi_benefits_total")} value={formatCents(prestacionesCents)} category="decimo" />
            <PayrollKpiCard
              icon={TrendingDown}
              label={tt("kpi_deductions_total")}
              value={formatCents(descuentosCents)}
              category="descuentos"
            />
            <PayrollKpiCard
              icon={HandCoins}
              label={tt("kpi_loans_granted")}
              value={formatCents(prestamosCents)}
              category="prestamos"
            />
            <PayrollKpiCard
              icon={AlertCircle}
              label={tt("kpi_pending_obligations")}
              value={formatCents(obligacionesPendientesCents)}
              sublabel={tt("kpi_pending_obligations_sub")}
              color="var(--destructive)"
            />
          </div>

          <MonthlyEvolutionChart rows={rows} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {obligations && <ProximasObligacionesCard obligations={obligations} />}

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">{tt("dist_by_employee")}</p>
              {withData.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("no_payroll_this_year")}</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {[...withData]
                    .sort((a, b) => b.totalPaidCents - a.totalPaidCents)
                    .map((r) => (
                      <div key={r.employee.id} className="flex items-center gap-2">
                        <EmployeeAvatar name={r.employee.name} employeeId={r.employee.id} sortOrder={r.employee.sortOrder} />
                        <span className="w-20 shrink-0 truncate text-xs text-foreground">{r.employee.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(r.totalPaidCents / maxEmployeeCents) * 100}%`,
                              backgroundColor: employeeAccentColor(r.employee.sortOrder),
                            }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {formatCents(r.totalPaidCents)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
