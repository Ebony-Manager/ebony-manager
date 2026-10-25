"use client";

import * as React from "react";
import Link from "next/link";
import { Wallet, CalendarClock, HandCoins, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentPeriod, formatCents, monthLabel, periodKey } from "@/lib/planilla/payroll-period";
import { isPeriodOccurred } from "@/lib/planilla/payroll-projection";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { usePlanillaOverview } from "./use-planilla-overview";
import { EmployeeAvatar } from "./employee-avatar";
import { PayrollKpiCard } from "./payroll-kpi-card";
import { MonthlyPayrollChart } from "./monthly-payroll-chart";
import { employeeProfilePath } from "@/lib/personal/paths";
import { SectionHeader, Stepper } from "@/components/shared/page-header";

/**
 * Dashboard de Planilla — cuatro números, un gráfico y dos listas cortas:
 *   1. KPIs: planilla del mes, pagado en el año (a hoy), préstamos por
 *      cobrar y empleados activos.
 *   2. Planilla por mes (una sola serie).
 *   3. Quién cuesta más (a hoy) y quién debe más.
 * Todo viene de UNA llamada al servidor (`usePlanillaOverview`). Décimo,
 * vacación y prima no se muestran: por ahora no aplican a esta planilla.
 */
export function DashboardView({ year, onYearChange }: { year: number; onYearChange: (year: number) => void }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const { rows, obligations, balances, composition, failed, retry } = usePlanillaOverview(year);
  const now = React.useMemo(() => currentPeriod(), []);

  const stats = React.useMemo(() => {
    if (!rows) return null;
    const occurredPaid = (totalsByPeriod: Record<string, number>) => {
      let sum = 0;
      for (let m = 1; m <= 12; m++) {
        for (const h of [1, 2] as const) {
          if (isPeriodOccurred(year, m, h, now)) sum += totalsByPeriod[periodKey(m, h)] ?? 0;
        }
      }
      return sum;
    };
    const perEmployee = rows
      .map((r) => ({ row: r, paid: occurredPaid(r.totalsByPeriod) }))
      .filter((x) => x.paid > 0)
      .sort((a, b) => b.paid - a.paid);
    const ytd = perEmployee.reduce((s, x) => s + x.paid, 0);
    const monthCents = rows.reduce(
      (s, r) => s + (r.totalsByPeriod[periodKey(now.month, 1)] ?? 0) + (r.totalsByPeriod[periodKey(now.month, 2)] ?? 0),
      0
    );
    const active = rows.filter((r) => r.employee.status === "ACTIVE").length;
    const debtors = rows
      .map((r) => ({ employee: r.employee, balance: balances[r.employee.id] ?? 0 }))
      .filter((x) => x.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    // A quién más se le ha prestado en el año (total otorgado, esté o no
    // pagado ya).
    const lent = rows
      .map((r) => ({ employee: r.employee, lent: r.conceptTotals.prestamosCents }))
      .filter((x) => x.lent > 0)
      .sort((a, b) => b.lent - a.lent);
    return { perEmployee, ytd, monthCents, active, debtors, lent };
  }, [rows, balances, year, now]);

  const loading = !rows || !obligations || !composition || !stats;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title={tt("tab_dashboard")}
        subtitle={tt("dashboard_subtitle")}
        action={<Stepper label={year} onPrev={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} className="[&>span]:min-w-14" />}
      />

      {failed ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {tt("load_failed")}
          <Button size="sm" variant="outline" onClick={retry}>
            {tt("retry")}
          </Button>
        </div>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PayrollKpiCard
              icon={CalendarClock}
              label={tt("kpi_month_payroll")}
              value={formatCents(stats.monthCents)}
              sublabel={monthLabel(lang, now.month)}
            />
            <PayrollKpiCard icon={Wallet} label={tt("dash_paid_ytd")} value={formatCents(stats.ytd)} />
            <PayrollKpiCard
              icon={HandCoins}
              label={tt("dash_loans_receivable")}
              value={formatCents(stats.debtors.reduce((sum, d) => sum + d.balance, 0))}
              sublabel={
                stats.debtors.length > 0
                  ? `${stats.debtors.length} ${tt("kpi_employees_count")} ${tt("con_saldo")}`
                  : tt("sin_saldos")
              }
            />
            <PayrollKpiCard
              icon={Users}
              label={tt("kpi_active_employees")}
              value={String(stats.active)}
            />
          </div>

          <MonthlyPayrollChart composition={composition} year={year} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">{tt("dash_top_title")}</p>
              {stats.perEmployee.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("no_payroll_this_year")}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.perEmployee.slice(0, 10).map(({ row, paid }, i) => (
                      <tr key={row.employee.id} className="border-b border-border last:border-0">
                        <td className="w-6 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pl-2">
                          <Link href={employeeProfilePath(row.employee.id, "dashboard")} className="flex items-center gap-2 hover:underline">
                            <EmployeeAvatar name={row.employee.name} employeeId={row.employee.id} sortOrder={row.employee.sortOrder} />
                            <span className="truncate">{row.employee.name}</span>
                          </Link>
                        </td>
                        <td className="w-24 py-1.5 pl-2">
                          <div className="h-1.5 w-full bg-muted">
                            <div
                              className="h-full bg-[var(--walnut)]"
                              style={{ width: `${(paid / stats.perEmployee[0].paid) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-foreground">{formatCents(paid)}</td>
                        <td className="w-12 py-1.5 pl-2 text-right text-xs tabular-nums text-muted-foreground">
                          {stats.ytd > 0 ? `${((paid / stats.ytd) * 100).toFixed(1)}%` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-foreground">{tt("dash_loans_top_title")}</p>
              {stats.debtors.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("dash_loans_none")}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.debtors.slice(0, 10).map(({ employee, balance }, i) => (
                      <tr key={employee.id} className="border-b border-border last:border-0">
                        <td className="w-6 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pl-2">
                          <Link href={employeeProfilePath(employee.id, "dashboard")} className="flex items-center gap-2 hover:underline">
                            <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} />
                            <span className="truncate">{employee.name}</span>
                          </Link>
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-foreground">{formatCents(balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p className="mt-5 mb-3 border-t border-border pt-4 text-sm font-medium text-foreground">
                {tt("dash_loans_year_title")}
              </p>
              {stats.lent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("dash_loans_year_none")}</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.lent.slice(0, 5).map(({ employee, lent }, i) => (
                      <tr key={employee.id} className="border-b border-border last:border-0">
                        <td className="w-6 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pl-2">
                          <Link href={employeeProfilePath(employee.id, "dashboard")} className="flex items-center gap-2 hover:underline">
                            <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} />
                            <span className="truncate">{employee.name}</span>
                          </Link>
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-foreground">{formatCents(lent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
