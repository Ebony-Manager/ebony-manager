"use client";

import * as React from "react";

import type { MonthPoint } from "@/lib/contractors/dashboard";
import { niceAxis } from "@/lib/planilla/chart-axis";
import { formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

const PLOT_H = 220;
const AXIS_W = 52;

/** Colores suaves de la paleta de Planilla (mezclados con blanco). */
const soft = (token: string, pct = 55) => `color-mix(in oklch, var(${token}) ${pct}%, var(--card))`;
const PAID = soft("--payroll-salario", 55);
const LOANS = soft("--payroll-prestamos", 45);

/**
 * Entregado por mes — barras apiladas (pagos abajo, préstamos encima) con
 * eje Y real de $0 a un máximo redondo y eje X por mes. Todas las barras
 * parten de la misma línea base. Al pasar el mouse: detalle del mes.
 */
export function ContractorsMonthlyChart({ months }: { months: MonthPoint[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);
  const [hover, setHover] = React.useState<number | null>(null);

  const axis = niceAxis(Math.max(...months.map((m) => m.paidCents + m.loansCents), 0) / 100, 6);
  const pxPerDollar = PLOT_H / axis.max;
  const label = (key: string, withYear: boolean) => {
    const [y, m] = key.split("-").map(Number);
    return `${monthLabel(lang, m).slice(0, 3)}${withYear ? ` ${String(y).slice(2)}` : ""}`;
  };
  const multiYear = new Set(months.map((m) => m.key.slice(0, 4))).size > 1;
  const hovered = hover !== null ? months[hover] : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{tt("cd_chart_title")}</p>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5" style={{ backgroundColor: PAID }} />
            {tt("cd_series_paid")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5" style={{ backgroundColor: LOANS }} />
            {tt("cd_series_loans")}
          </span>
        </div>
      </div>

      <div className="relative mt-4 flex">
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

        <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
          {axis.ticks.map((tick) => (
            <div
              key={tick}
              className={`absolute inset-x-0 ${tick === 0 ? "border-t border-border" : "border-t border-dashed border-border/60"}`}
              style={{ bottom: tick * pxPerDollar }}
            />
          ))}
          <div className="absolute inset-y-0 left-0 border-l border-border" />

          <div className="relative flex" style={{ height: PLOT_H }}>
            {months.map((m, i) => (
              <div
                key={m.key}
                className={`relative flex-1 ${hover === i ? "bg-muted/50" : ""}`}
                onMouseEnter={() => setHover(i)}
              >
                <div className="absolute inset-x-[18%] bottom-0 top-0">
                  <div
                    className="absolute inset-x-0"
                    style={{ bottom: 0, height: (m.paidCents / 100) * pxPerDollar, backgroundColor: PAID }}
                  />
                  <div
                    className="absolute inset-x-0"
                    style={{
                      bottom: (m.paidCents / 100) * pxPerDollar,
                      height: (m.loansCents / 100) * pxPerDollar,
                      backgroundColor: LOANS,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex pt-1">
            {months.map((m) => (
              <span key={m.key} className="flex-1 text-center text-[10px] text-muted-foreground">
                {label(m.key, multiYear)}
              </span>
            ))}
          </div>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-60 border border-border bg-popover p-4 shadow-md"
              style={
                hover < months.length / 2
                  ? { left: `${((hover + 1) / months.length) * 100}%` }
                  : { right: `${((months.length - hover) / months.length) * 100}%` }
              }
            >
              <p className="text-base font-semibold text-foreground">
                {(() => {
                  const [y, m] = hovered.key.split("-").map(Number);
                  return `${monthLabel(lang, m)} ${y}`;
                })()}
              </p>
              <div className="mt-3 flex flex-col gap-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-3 shrink-0" style={{ backgroundColor: PAID }} />
                  <span className="flex-1 text-foreground">{tt("cd_series_paid")}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatCents(hovered.paidCents)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-3 shrink-0" style={{ backgroundColor: LOANS }} />
                  <span className="flex-1 text-foreground">{tt("cd_series_loans")}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatCents(hovered.loansCents)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">{tt("cd_tip_total")}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCents(hovered.paidCents + hovered.loansCents)}
                </span>
              </div>
              {hovered.billedCents > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {tt("cd_tip_billed")}: <span className="tabular-nums">{formatCents(hovered.billedCents)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{tt("cd_chart_hint")}</p>
    </div>
  );
}
