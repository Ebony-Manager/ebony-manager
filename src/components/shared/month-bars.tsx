"use client";

import { monthLabel } from "@/lib/planilla/payroll-period";
import { cn } from "@/lib/utils";

/**
 * Barras por mes (12) para los Resúmenes: una barra por mes con su valor
 * encima; el mes elegido resalta y se puede tocar para elegir otro.
 */
export function MonthBars({
  values,
  format,
  lang,
  color = "var(--primary)",
  selected,
  onSelect,
}: {
  values: number[];
  format: (n: number) => string;
  lang: "es" | "en";
  color?: string;
  selected?: number | null;
  onSelect?: (month: number) => void;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-40 items-end gap-1 sm:gap-2">
      {values.map((v, i) => {
        const month = i + 1;
        const active = selected === month;
        return (
          <button
            key={month}
            type="button"
            onClick={() => onSelect?.(month)}
            disabled={!onSelect}
            title={`${monthLabel(lang, month)}: ${format(v)}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className={cn("text-[10px] tabular-nums text-muted-foreground", !v && "invisible")}>{format(v)}</span>
            <span
              className={cn("w-full rounded-t-sm transition-opacity", selected != null && !active && "opacity-40 group-hover:opacity-70")}
              style={{ height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%`, backgroundColor: v ? color : "var(--muted)" }}
            />
            <span className={cn("text-[10px] capitalize", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {monthLabel(lang, month).slice(0, 3)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
