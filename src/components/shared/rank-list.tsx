"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RankItem {
  key: string;
  label: string;
  /** Para la barra (proporcional al mayor). */
  value: number;
  /** Cómo se muestra el valor ("3 días", "$120"). */
  display: string;
  sub?: string;
  href?: string;
}

/**
 * Ranking de toda la app (Resumen de Personal, de Almacén, Dashboard): título
 * con ícono de color, puesto, nombre, barra proporcional y valor. Muestra los
 * primeros `limit` y "Ver todos" despliega el resto.
 */
export function RankList({
  title,
  icon: Icon,
  color = "var(--primary)",
  items,
  empty,
  limit = 5,
  moreLabel,
  lessLabel,
}: {
  title: string;
  icon: LucideIcon;
  color?: string;
  items: RankItem[];
  empty: string;
  limit?: number;
  moreLabel: string;
  lessLabel: string;
}) {
  const [all, setAll] = React.useState(false);
  const max = Math.max(1, ...items.map((i) => i.value));
  const shown = all ? items : items.slice(0, limit);
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex size-6 items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}>
          <Icon className="size-3.5" style={{ color }} />
        </span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {shown.map((item, i) => {
            const label = (
              <span className="min-w-0 truncate text-sm text-foreground">
                {item.label}
                {item.sub && <span className="ml-1 text-xs text-muted-foreground">{item.sub}</span>}
              </span>
            );
            return (
              <li key={item.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2">
                <span className="text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  {item.href ? (
                    <Link href={item.href} className="min-w-0 truncate hover:underline">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }} />
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">{item.display}</span>
              </li>
            );
          })}
        </ol>
      )}
      {items.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className={cn("self-start text-xs font-medium text-primary hover:underline")}>
          {all ? lessLabel : `${moreLabel} (${items.length})`}
        </button>
      )}
    </section>
  );
}
