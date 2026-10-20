"use client";

import * as React from "react";

import type { MonthComposition } from "@/lib/planilla/payroll-reports";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { isMonthOccurred } from "@/lib/planilla/payroll-projection";
import { monthShort } from "@/lib/planilla/format";
import { niceAxis } from "@/lib/planilla/chart-axis";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

const PLOT_H = 260; // alto del área de barras
const AXIS_W = 52;

/** Cuatro colores suaves de la paleta de Planilla (mezclados con blanco). */
const soft = (token: string, pct = 60) => `color-mix(in oklch, var(${token}) ${pct}%, var(--card))`;
const SERIES = {
  salary: { color: soft("--payroll-salario", 48), label: "dash_series_salary" },
  extras: { color: soft("--payroll-bonos"), label: "dash_series_extras" },
  deductions: { color: soft("--payroll-descuentos"), label: "dash_series_deductions" },
  loans: { color: soft("--payroll-prestamos", 45), label: "dash_series_loans" },
} as const;
type SeriesKey = keyof typeof SERIES;

/**
 * Planilla por mes — barras apiladas con eje Y real (de $0 hasta un máximo
 * redondo, ej. $35k) y eje X por mes. De abajo hacia arriba: salarios
 * (azul), bonificaciones (verde), descuentos (rojo) y préstamos (gris).
 * Todas las barras salen de la misma línea base ($0), por eso quedan
 * alineadas. Los meses que todavía no llegan se ven atenuados.
 */
export function MonthlyPayrollChart({ composition, year }: { composition: MonthComposition[]; year: number }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const now = React.useMemo(() => currentPeriod(), []);
  const [hover, setHover] = React.useState<number | null>(null);

  const stackCents = (m: MonthComposition) => m.salaryCents + m.extrasCents + m.deductionsCents + m.loanGivenCents;
  const axis = niceAxis(Math.max(...composition.map(stackCents), 0) / 100, 7);
  const pxPerDollar = PLOT_H / axis.max;

  const hovered = hover !== null ? composition[hover] : null;
  const total = hovered ? hovered.salaryCents + hovered.extrasCents + hovered.deductionsCents + hovered.loanGivenCents : 0;
  const pct = (cents: number) => (total > 0 ? `${((cents / total) * 100).toFixed(0)}%` : "—");

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{tt("dash_chart_title")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2.5" style={{ backgroundColor: SERIES[k].color }} />
              {tt(SERIES[k].label)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex">
        {/* Eje Y: solo mide lo que va encima del salario base. */}
        <div className="relative shrink-0" style={{ width: AXIS_W, height: PLOT_H }}>
          {axis.ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 translate-y-1/2 text-[10px] leading-none tabular-nums text-muted-foreground"
              style={{ bottom: tick * pxPerDollar }}
            >
              {tick === 0 ? "$0" : tick >= 1000 ? `$${tick / 1000}k` : `$${tick}`}
            </span>
          ))}
        </div>

        {/* Área de barras */}
        <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
          {/* Líneas de la cuadrícula (una por marca del eje Y) + línea base. */}
          {axis.ticks.map((tick) => (
            <div
              key={tick}
              className={`absolute inset-x-0 ${tick === 0 ? "border-t border-border" : "border-t border-dashed border-border/60"}`}
              style={{ bottom: tick * pxPerDollar }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-border" />
          <div className="absolute inset-y-0 left-0 border-l border-border" />

          <div className="relative flex" style={{ height: PLOT_H }}>
            {composition.map((m, i) => {
              const occurred = isMonthOccurred(year, m.month, now);
              // De abajo hacia arriba, todo desde $0.
              const segs: { key: SeriesKey; cents: number }[] = [
                { key: "salary", cents: m.salaryCents },
                { key: "extras", cents: m.extrasCents },
                { key: "deductions", cents: m.deductionsCents },
                { key: "loans", cents: m.loanGivenCents },
              ];
              let y = 0;
              return (
                <div
                  key={m.month}
                  className={`relative flex-1 ${hover === i ? "bg-muted/50" : ""}`}
                  style={{ opacity: occurred ? 1 : 0.5 }}
                  onMouseEnter={() => setHover(i)}
                >
                  <div className="absolute inset-x-[18%] bottom-0 top-0">
                    {segs.map(({ key, cents }) => {
                      const h = (cents / 100) * pxPerDollar;
                      if (h <= 0) return null;
                      const bottom = y;
                      y += h;
                      return (
                        <div
                          key={key}
                          className="absolute inset-x-0"
                          style={{ bottom, height: Math.max(h, 1), backgroundColor: SERIES[key].color }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Eje X: un mes por columna, bajo la misma línea base. */}
          <div className="flex pt-1">
            {composition.map((m) => (
              <span key={m.month} className="flex-1 text-center text-[10px] text-muted-foreground">
                {monthShort(lang, m.month)}
              </span>
            ))}
          </div>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-64 border border-border bg-popover p-4 shadow-md"
              style={hover < 6 ? { left: `${((hover + 1) / 12) * 100}%` } : { right: `${((12 - hover) / 12) * 100}%` }}
            >
              <p className="text-base font-semibold text-foreground">
                {monthLabel(lang, hovered.month)} {year}
              </p>
              {total === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{tt("dash_tip_empty")}</p>
              ) : (
                <>
                  <div className="mt-3 flex flex-col gap-2.5 text-sm">
                    {(["salary", "extras", "deductions", "loans"] as SeriesKey[]).map((k) => {
                      const cents =
                        k === "salary"
                          ? hovered.salaryCents
                          : k === "extras"
                            ? hovered.extrasCents
                            : k === "deductions"
                              ? hovered.deductionsCents
                              : hovered.loanGivenCents;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="size-3 shrink-0" style={{ backgroundColor: SERIES[k].color }} />
                          <span className="flex-1 text-foreground">{tt(SERIES[k].label)}</span>
                          <span className="font-medium tabular-nums text-foreground">{formatCents(cents)}</span>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct(cents)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">{tt("dash_tip_net")}</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatCents(hovered.netCents)}</span>
                  </div>
                  {!isMonthOccurred(year, hovered.month, now) && (
                    <p className="mt-2 text-xs italic text-muted-foreground">{tt("dash_tip_projection")}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{tt("dash_chart_hint")}</p>
    </div>
  );
}
