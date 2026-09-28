"use client";

import * as React from "react";

import type { PayrollEmployeeAnnualSummary } from "@/types/planilla";
import { periodKey, formatCents } from "@/lib/planilla/payroll-period";
import { employeeAccentColor } from "@/lib/planilla/payroll-colors";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

const CHART_HEIGHT = 176;

/**
 * Evolución mensual del gasto total en planilla — barras apiladas, un
 * segmento por empleado-con-historial-real por mes. Portado de Atlas.
 * Filtra por `monthsWithActivity > 0` (no por status): un empleado que
 * se fue igual tiene meses reales ya pagados ese año.
 */
export function MonthlyEvolutionChart({ rows, title }: { rows: PayrollEmployeeAnnualSummary[]; title?: string }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [mode, setMode] = React.useState<"total" | "acumulado">("total");
  const withData = React.useMemo(() => rows.filter((r) => r.monthsWithActivity > 0), [rows]);
  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const monthlyByEmployee = React.useMemo(
    () =>
      withData.map((row) =>
        months.map((m) => (row.totalsByPeriod[periodKey(m, 1)] ?? 0) + (row.totalsByPeriod[periodKey(m, 2)] ?? 0))
      ),
    [withData, months]
  );

  const hasDataForMonth = months.map((_, i) => monthlyByEmployee.some((arr) => arr[i] > 0));

  const seriesByEmployee = React.useMemo(() => {
    if (mode === "total") return monthlyByEmployee;
    return monthlyByEmployee.map((monthly) => {
      let running = 0;
      return monthly.map((v) => (running += v));
    });
  }, [monthlyByEmployee, mode]);

  const monthTotals = months.map((_, i) => seriesByEmployee.reduce((s, arr) => s + arr[i], 0));
  const max = Math.max(...monthTotals, 1);

  return (
    <div className="rounded-none border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title ?? tt("evolution_title")}</p>
        <div className="flex items-center gap-0.5 rounded-none border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("total")}
            className={`rounded-none px-2 py-1 font-medium transition-colors ${mode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tt("chart_total")}
          </button>
          <button
            type="button"
            onClick={() => setMode("acumulado")}
            className={`rounded-none px-2 py-1 font-medium transition-colors ${mode === "acumulado" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tt("chart_acumulado")}
          </button>
        </div>
      </div>

      {withData.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{tt("no_data_to_chart")}</p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-2 overflow-x-auto" style={{ height: CHART_HEIGHT + 34 }}>
            {months.map((m, i) => {
              const total = monthTotals[i];
              const hasData = hasDataForMonth[i];
              if (!hasData) {
                return (
                  <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div className="w-full rounded-t-none" style={{ height: 22, border: "1px dashed var(--border)" }} />
                    <span className="text-[10px] text-muted-foreground">{monthShort(lang, m)}</span>
                  </div>
                );
              }
              const barHeight = Math.max((total / max) * CHART_HEIGHT, 10);
              return (
                <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-medium tabular-nums text-foreground">{formatCents(total)}</span>
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-none" style={{ height: barHeight }}>
                    {withData.map((row, empIdx) => {
                      const value = seriesByEmployee[empIdx][i];
                      if (value <= 0) return null;
                      return (
                        <div
                          key={row.employee.id}
                          style={{
                            height: `${(value / total) * 100}%`,
                            backgroundColor: employeeAccentColor(row.employee.sortOrder),
                          }}
                          title={`${row.employee.name}: ${formatCents(value)}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{monthShort(lang, m)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
            {withData.map((row) => (
              <span key={row.employee.id} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: employeeAccentColor(row.employee.sortOrder) }}
                />
                {row.employee.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
