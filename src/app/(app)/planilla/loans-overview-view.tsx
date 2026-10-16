"use client";

import * as React from "react";
import { CheckCircle2, HandCoins, Hourglass, ListChecks, Percent } from "lucide-react";

import type { LoanCategory, LoanOverviewRow, PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, shortPeriodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getLoansOverviewAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";
import { PayrollKpiCard } from "./payroll-kpi-card";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

type Filter = "all" | "money" | "items";

const MONEY: LoanCategory[] = ["prestamo", "adelanto"];

/**
 * Vista general de préstamos: todo lo que la empresa le ha prestado a sus
 * empleados (y las herramientas / daños a cuotas), con el avance de cada uno
 * — "1 de 3" cuotas pagadas — lo que ya se cobró y lo que falta. Por defecto
 * solo lo vigente; el historial (pagados y cancelados) se abre con un
 * interruptor. Clic en una fila abre el detalle de ese empleado.
 */
export function LoansOverviewView({
  employees,
  reloadSignal,
  onOpenEmployee,
}: {
  employees: PayrollEmployee[];
  reloadSignal: number;
  onOpenEmployee: (employeeId: string, tab: "prestamos" | "herramientas") => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [rows, setRows] = React.useState<LoanOverviewRow[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [history, setHistory] = React.useState(false);

  const load = React.useCallback(() => {
    getLoansOverviewAction()
      .then((r) => {
        setRows(r);
        setFailed(false);
      })
      .catch((err) => {
        console.error("Planilla: no se pudo cargar la vista de préstamos", err);
        setFailed(true);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load, reloadSignal]);

  const byId = React.useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const isDone = (r: LoanOverviewRow) => r.status === "cancelled" || (r.installmentCount > 0 && r.pendingCents === 0);

  // Solo los empleados que el filtro de categoría de la pantalla deja pasar.
  const scoped = (rows ?? []).filter((r) => byId.has(r.employeeId));
  const active = scoped.filter((r) => !isDone(r));
  const kpiLent = active.reduce((s, r) => s + r.principalCents, 0);
  const kpiPending = active.reduce((s, r) => s + r.pendingCents, 0);
  const kpiCollected = active.reduce((s, r) => s + r.paidCents, 0);

  // Intereses: lo pactado en préstamos no cancelados y la parte ya cobrada
  // (proporcional a lo pagado de cada préstamo) — ganancia de la empresa.
  const interestAgreed = scoped.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.interestCents, 0);
  const interestCollected = scoped.reduce((s, r) => {
    const total = r.principalCents + r.interestCents;
    return s + (r.interestCents > 0 && total > 0 ? Math.round(r.interestCents * Math.min(r.paidCents / total, 1)) : 0);
  }, 0);

  const shown = scoped
    .filter((r) => (history ? true : !isDone(r)))
    .filter((r) => (filter === "all" ? true : filter === "money" ? MONEY.includes(r.category) : !MONEY.includes(r.category)))
    .sort((a, b) => {
      const ea = byId.get(a.employeeId)?.name ?? "";
      const eb = byId.get(b.employeeId)?.name ?? "";
      return Number(isDone(a)) - Number(isDone(b)) || ea.localeCompare(eb) || a.requestDate.localeCompare(b.requestDate);
    });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: tt("lo_filter_all") },
    { key: "money", label: tt("lo_filter_money") },
    { key: "items", label: tt("lo_filter_items") },
  ];
  const th = "px-3 py-2 font-medium whitespace-nowrap";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PayrollKpiCard icon={HandCoins} label={tt("lo_kpi_lent")} value={formatCents(kpiLent)} />
        <PayrollKpiCard icon={CheckCircle2} label={tt("lo_kpi_collected")} value={formatCents(kpiCollected)} />
        <PayrollKpiCard icon={Hourglass} label={tt("lo_kpi_pending")} value={formatCents(kpiPending)} />
        <PayrollKpiCard icon={ListChecks} label={tt("lo_kpi_count")} value={String(active.length)} />
        <PayrollKpiCard
          icon={Percent}
          label={tt("lo_kpi_interest")}
          value={formatCents(interestCollected)}
          sublabel={`${tt("lo_kpi_interest_of")} ${formatCents(interestAgreed)}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "secondary" : "ghost"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          {tt("lo_show_history")}
        </label>
      </div>

      {failed ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>{tt("load_failed")}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>
            {tt("retry")}
          </Button>
        </div>
      ) : rows === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tt("loading")}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tt("lo_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-border bg-card">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className={th}>{tt("lo_col_employee")}</th>
                <th className={th}>{tt("lo_col_type")}</th>
                <th className={`${th} text-right`}>{tt("lo_col_amount")}</th>
                <th className={th}>{tt("lo_col_progress")}</th>
                <th className={`${th} text-right`}>{tt("lo_col_paid")}</th>
                <th className={`${th} text-right`}>{tt("lo_col_pending")}</th>
                <th className={th}>{tt("lo_col_next")}</th>
                <th className={th}>{tt("lo_col_end")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const emp = byId.get(r.employeeId);
                if (!emp) return null;
                const done = isDone(r);
                const pct = r.installmentCount > 0 ? Math.round((r.paidCount / r.installmentCount) * 100) : 0;
                const label = t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[r.category] as keyof typeof strings.planilla]);
                return (
                  <tr
                    key={r.loanId}
                    className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${done ? "text-muted-foreground" : ""}`}
                    title={tt("lo_open_hint")}
                    onClick={() => onOpenEmployee(emp.id, MONEY.includes(r.category) ? "prestamos" : "herramientas")}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <EmployeeAvatar name={emp.name} employeeId={emp.id} sortOrder={emp.sortOrder} size="sm" />
                        <span className="font-medium text-foreground">{emp.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {label}
                      <span className="ml-1 text-xs text-muted-foreground">· {formatDate(lang, r.requestDate)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCents(r.principalCents)}
                      {r.interestCents > 0 && (
                        <span className="block text-[11px] text-muted-foreground">+ {formatCents(r.interestCents)} {tt("lo_interest_short")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-walnut" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums">
                          {r.paidCount} {tt("loan_of")} {r.installmentCount}
                        </span>
                        {r.status === "cancelled" && <span className="text-xs">({tt("lo_cancelled")})</span>}
                        {r.status !== "cancelled" && done && <span className="text-xs">({tt("lo_done")})</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCents(r.paidCents)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                      {formatCents(done ? 0 : r.pendingCents)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {!done && r.next ? `${shortPeriodLabel(lang, r.next.period)} · ${formatCents(r.next.amountCents)}` : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{r.last ? shortPeriodLabel(lang, r.last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 text-xs font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  {tt("lo_total")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCents(shown.reduce((s, r) => s + r.principalCents, 0))}
                </td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(shown.reduce((s, r) => s + r.paidCents, 0))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCents(shown.filter((r) => !isDone(r)).reduce((s, r) => s + r.pendingCents, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
