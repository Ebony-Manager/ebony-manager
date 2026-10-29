"use client";

import * as React from "react";

import type { ProjectSupplyLine } from "@/types/almacen";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { EmptyState } from "@/components/shared/page-header";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { ItemThumb, qtyWithUnit } from "../../almacen/shared";

type View = "producto" | "entrega";

/**
 * Proyecto → Suministros: lo que salió del almacén para la obra, sumado por
 * producto o entrega por entrega (fecha y quién lo recibió). Los montos solo
 * aparecen con Costos del almacén (la base no manda el costo a los demás).
 */
export function ProjectSupplies({ lines }: { lines: ProjectSupplyLine[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.proyectos, vars?: Record<string, string | number>) => {
    let s = t(lang, strings.proyectos[k]);
    for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
    return s;
  };
  const [view, setView] = React.useState<View>("producto");
  const withCost = lines.some((l) => l.unitCostCents != null);
  const cost = (l: ProjectSupplyLine) => (l.unitCostCents != null ? Math.round(l.unitCostCents * l.qty) : null);
  const total = lines.reduce((s, l) => s + (cost(l) ?? 0), 0);
  const deliveries = new Set(lines.map((l) => l.issueId)).size;

  const byProduct = React.useMemo(() => {
    const map = new Map<string, { line: ProjectSupplyLine; qty: number; cents: number | null; issues: Set<string> }>();
    for (const l of lines) {
      const g = map.get(l.variantId) ?? { line: l, qty: 0, cents: null, issues: new Set<string>() };
      g.qty += l.qty;
      const c = l.unitCostCents != null ? Math.round(l.unitCostCents * l.qty) : null;
      if (c != null) g.cents = (g.cents ?? 0) + c;
      g.issues.add(l.issueId);
      map.set(l.variantId, g);
    }
    return [...map.values()].sort((a, b) => (b.cents ?? 0) - (a.cents ?? 0) || a.line.name.localeCompare(b.line.name, "es"));
  }, [lines]);

  const byIssue = React.useMemo(() => {
    const map = new Map<string, ProjectSupplyLine[]>();
    for (const l of lines) map.set(l.issueId, [...(map.get(l.issueId) ?? []), l]);
    return [...map.values()];
  }, [lines]);

  if (lines.length === 0) return <EmptyState>{tt("sup_empty")}</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{withCost ? tt("sup_hint_cost") : tt("sup_hint")}</p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">{deliveries === 1 ? tt("sup_deliveries_1") : tt("sup_deliveries", { n: deliveries })}</span>
            {withCost && (
              <>
                {" · "}
                <span className="font-semibold tabular-nums">
                  {tt("sup_total")} {formatCents(total)}
                </span>
              </>
            )}
          </p>
        </div>
        <SegmentedFilter
          value={view}
          onChange={setView}
          options={[
            { value: "producto", label: tt("sup_by_product") },
            { value: "entrega", label: tt("sup_by_date") },
          ]}
        />
      </div>

      {view === "producto" ? (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {byProduct.map((g) => (
            <li key={g.line.variantId} className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 text-sm last:border-0">
              <ItemThumb path={g.line.photoPath} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{g.line.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {g.issues.size === 1 ? tt("sup_deliveries_1") : tt("sup_deliveries", { n: g.issues.size })}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block tabular-nums">{qtyWithUnit(g.qty, g.line.unit, lang)}</span>
                {withCost && (
                  <span className="block text-xs tabular-nums text-muted-foreground">{g.cents != null ? formatCents(g.cents) : tt("sup_no_cost")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          {byIssue.map((issue) => {
            const first = issue[0];
            const issueCost = issue.reduce((s, l) => s + (cost(l) ?? 0), 0);
            return (
              <section key={first.issueId} className="overflow-hidden rounded-lg border border-border bg-card">
                <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/20 px-3.5 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{formatDateCompact(lang, first.issuedOn)}</span>
                    {first.recipient && <span className="text-muted-foreground"> · {first.recipient}</span>}
                  </span>
                  {withCost && <span className="shrink-0 font-medium tabular-nums">{formatCents(issueCost)}</span>}
                </header>
                <ul>
                  {issue.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2 text-sm last:border-0">
                      <span className="min-w-0 break-words">{l.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{qtyWithUnit(l.qty, l.unit, lang)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
