"use client";

import * as React from "react";
import { Award, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Gift, Wallet } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { currentPeriod, periodOrdinal, formatCents } from "@/lib/planilla/payroll-period";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getEmployeeAnnualDetailAction } from "./actions";
import { PayrollKpiCard } from "./payroll-kpi-card";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];

/**
 * "Historial" del perfil del empleado — reemplaza a la vieja pestaña
 * global "Resumen Anual" (ahora por empleado, dentro de su propio
 * perfil). DE SOLO LECTURA: la edición de quincenas sigue siendo en
 * Registro. Reusa `getEmployeeAnnualDetailAction` (mismo dato que ya
 * consumía el sheet de Detalle) — nada de fórmulas nuevas.
 *
 * Dos partes:
 *  1. Panorama anual (colapsado por default): total pagado en lo que va
 *     del año + el acumulado ACTUAL de Décimo/Vacación/Prima (el mismo
 *     "peak" que ya calculaba el desglose del sheet de Detalle).
 *  2. Tabla compacta, una fila por quincena con actividad, más reciente
 *     primero.
 */
export function EmployeeHistorySection({ employee }: { employee: PayrollEmployee }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [year, setYear] = React.useState(() => currentPeriod().year);
  const [rows, setRows] = React.useState<DetailRow[] | null>(null);
  const [overviewOpen, setOverviewOpen] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- limpia filas del año/empleado anterior antes de la carga asíncrona. */
  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    getEmployeeAnnualDetailAction(employee.id, year).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [employee.id, year]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasBenefitsBase =
    employee.benefitsBaseSalaryCents != null && employee.benefitsBaseSalaryCents !== employee.baseSalaryCents;

  const nowOrd = React.useMemo(() => {
    const c = currentPeriod();
    return periodOrdinal(c.year, c.month, c.half);
  }, []);

  // La fila elapsada más reciente del año — el acumulado de Décimo/
  // Vacación/Prima "a la fecha" es su valor ahí (mismo criterio que el
  // desglose mensual del viejo sheet de Detalle: crece mes a mes y
  // aterriza exacto en cada cuota).
  const asOfRow = React.useMemo(() => {
    if (!rows) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (periodOrdinal(rows[i].year, rows[i].month, rows[i].half) <= nowOrd) return rows[i];
    }
    return null;
  }, [rows, nowOrd]);

  const totalPaidYtdCents = (rows ?? [])
    .filter((r) => r.entry !== null)
    .reduce((sum, r) => sum + r.totalCents, 0);
  const decimoAccruedCents = asOfRow
    ? hasBenefitsBase
      ? (asOfRow.decimoAccrualBenefitsCents ?? 0)
      : asOfRow.decimoAccrualCents
    : 0;
  const vacacionAccruedCents = asOfRow
    ? hasBenefitsBase
      ? (asOfRow.vacationAccrualBenefitsCents ?? 0)
      : asOfRow.vacationAccrualCents
    : 0;
  const primaAccruedCents = asOfRow ? asOfRow.primaAntiguedadAccrualCents : 0;

  // Una fila por quincena con actividad real, más reciente primero —
  // igual filtro que el viejo sheet de Detalle, orden invertido.
  const displayRows = (rows ?? [])
    .filter((r) => r.entry !== null || r.ledgerDebtCents > 0 || r.ledgerPaymentCents > 0)
    .slice()
    .reverse();

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{tt("hist_title")}</h3>
          <p className="text-xs text-muted-foreground">{tt("hist_subtitle")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-none border border-border px-1">
          <button
            type="button"
            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-14 text-center text-sm font-medium text-foreground">{year}</span>
          <button
            type="button"
            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Panorama anual — colapsado por default. */}
      <div className="rounded-none border border-border">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/40"
          onClick={() => setOverviewOpen((v) => !v)}
        >
          {tt("hist_overview_toggle")}
          <ChevronDown
            className={`ml-auto size-3.5 text-muted-foreground transition-transform ${overviewOpen ? "" : "-rotate-90"}`}
          />
        </button>
        {overviewOpen && (
          <div className="flex flex-col gap-2 border-t border-border p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <PayrollKpiCard
                icon={Wallet}
                label={`${tt("hist_total_paid")} ${year}`}
                value={formatCents(totalPaidYtdCents)}
                category="salario"
              />
              <PayrollKpiCard
                icon={Gift}
                label={tt("hist_decimo_accrued")}
                value={formatCents(decimoAccruedCents)}
                category="decimo"
              />
              <PayrollKpiCard
                icon={CalendarDays}
                label={tt("hist_vacacion_accrued")}
                value={formatCents(vacacionAccruedCents)}
                category="vacacion"
              />
              <PayrollKpiCard
                icon={Award}
                label={tt("hist_prima_accrued")}
                value={formatCents(primaAccruedCents)}
                category="prima"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{tt("hist_accrued_hint")}</p>
          </div>
        )}
      </div>

      {/* Tabla compacta por quincena, más reciente primero. */}
      {rows === null ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{tt("loading")}</p>
      ) : displayRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tt("no_pagos_en")} {year}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{tt("col_quincena")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_base")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_extras")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_descuentos")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_prestamos")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_total")}</th>
                <th className="px-3 py-2 text-right font-medium">{tt("col_saldo")}</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={`${row.year}-${row.month}-${row.half}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 text-foreground">
                    {monthShort(lang, row.month)} · {row.half === 1 ? "1ra" : "2da"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.entry ? formatCents(row.entry.basePayCents) : "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.entry
                      ? formatCents(
                          row.entry.extraHoursCents +
                            row.entry.extraDaysCents +
                            row.entry.viaticosCents +
                            row.entry.bonusCents +
                            row.entry.diasLibresCents +
                            row.entry.decimoPaidCents +
                            row.entry.vacationPaidCents
                        )
                      : "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.entry ? formatCents(row.entry.otherDeductionCents + row.ledgerPaymentCents) : "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.ledgerDebtCents > 0 ? `+${formatCents(row.ledgerDebtCents)}` : "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-foreground">
                    {formatCents(row.totalCents)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatCents(row.runningLedgerBalanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
