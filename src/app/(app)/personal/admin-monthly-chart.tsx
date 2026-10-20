"use client";

import * as React from "react";

import type { AdminMonth } from "@/lib/admin/dashboard";
import { formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { monthShort } from "@/lib/planilla/format";
import { niceAxis } from "@/lib/planilla/chart-axis";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

const PLOT_H = 280;
const AXIS_W = 56;

const soft = (token: string, pct = 60) => `color-mix(in oklch, var(${token}) ${pct}%, var(--card))`;
export const ADMIN_SERIES = {
  taller: { color: soft("--payroll-salario", 55), label: "ad_series_taller" },
  admin: { color: soft("--payroll-bonos", 55), label: "ad_series_admin" },
  contractors: { color: soft("--payroll-decimo", 65), label: "ad_series_contractors" },
} as const;
export type AdminSeriesKey = keyof typeof ADMIN_SERIES;

const cents = (m: AdminMonth, k: AdminSeriesKey) =>
  k === "taller" ? m.tallerCents : k === "admin" ? m.adminCents : m.contractorsCents;

/**
 * Pagado por mes — barras apiladas con eje Y real ($0 hasta un máximo
 * redondo) y eje X por mes, con líneas punteadas. De abajo hacia arriba:
 * Administrativos, Taller y Contratistas. Clic en una barra elige ese mes
 * para el resto de la pantalla; los meses que no han llegado se atenúan.
 */
export function AdminMonthlyChart({
  months,
  year,
  selectedMonth,
  onSelectMonth,
}: {
  months: AdminMonth[];
  year: number;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.adminDash) => t(lang, strings.adminDash[k]);
  const [hover, setHover] = React.useState<number | null>(null);

  const axis = niceAxis(Math.max(...months.map((m) => m.totalCents), 0) / 100, 7);
  const px = PLOT_H / axis.max;
  const hovered = hover !== null ? months[hover] : null;
  const order: AdminSeriesKey[] = ["admin", "taller", "contractors"];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{tt("chart_title")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {order.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2.5" style={{ backgroundColor: ADMIN_SERIES[k].color }} />
              {tt(ADMIN_SERIES[k].label)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex">
        <div className="relative shrink-0" style={{ width: AXIS_W, height: PLOT_H }}>
          {axis.ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 translate-y-1/2 text-[10px] leading-none tabular-nums text-muted-foreground"
              style={{ bottom: tick * px }}
            >
              {tick === 0 ? "$0" : tick >= 1000 ? `$${tick / 1000}k` : `$${tick}`}
            </span>
          ))}
        </div>

        <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
          {axis.ticks.map((tick) => (
            <div
              key={tick}
              className={`absolute inset-x-0 ${tick === 0 ? "border-t border-border" : "border-t border-dashed border-border/70"}`}
              style={{ bottom: tick * px }}
            />
          ))}
          <div className="absolute inset-y-0 left-0 border-l border-border" />

          <div className="relative flex" style={{ height: PLOT_H }}>
            {months.map((m, i) => {
              let y = 0;
              const isSelected = m.month === selectedMonth;
              return (
                <button
                  type="button"
                  key={m.month}
                  className={`relative flex-1 cursor-pointer ${hover === i || isSelected ? "bg-muted/50" : ""}`}
                  style={{ opacity: m.occurred ? 1 : 0.45 }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onSelectMonth(m.month)}
                  aria-label={`${monthLabel(lang, m.month)} ${year}`}
                  aria-pressed={isSelected}
                >
                  <div className="absolute inset-x-[20%] bottom-0 top-0">
                    {order.map((k) => {
                      const h = (cents(m, k) / 100) * px;
                      if (h <= 0) return null;
                      const bottom = y;
                      y += h;
                      return (
                        <div
                          key={k}
                          className="absolute inset-x-0"
                          style={{ bottom, height: Math.max(h, 1), backgroundColor: ADMIN_SERIES[k].color }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex pt-1">
            {months.map((m) => (
              <span
                key={m.month}
                className={`flex-1 text-center text-[10px] ${m.month === selectedMonth ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
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
              {hovered.totalCents === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{tt("tip_empty")}</p>
              ) : (
                <>
                  <div className="mt-3 flex flex-col gap-2.5 text-sm">
                    {order.map((k) => {
                      const v = cents(hovered, k);
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="size-3 shrink-0" style={{ backgroundColor: ADMIN_SERIES[k].color }} />
                          <span className="flex-1 text-foreground">{tt(ADMIN_SERIES[k].label)}</span>
                          <span className="font-medium tabular-nums text-foreground">{formatCents(v)}</span>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                            {hovered.totalCents > 0 ? `${((v / hovered.totalCents) * 100).toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">{tt("tip_total")}</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatCents(hovered.totalCents)}</span>
                  </div>
                  {!hovered.occurred && <p className="mt-2 text-xs italic text-muted-foreground">{tt("tip_projection")}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{tt("chart_hint")}</p>
    </div>
  );
}
