"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import type { InventoryCategory, InventoryItem, InventoryMovement, InventoryPerson, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/components/shared/search-input";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatQty } from "@/lib/almacen/inventory";
import { AdjustmentDialog } from "../adjustment-dialog";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, qtyWithUnit, useTa, useVariantIndex } from "../shared";
import { matchesSearch, normalizeSearchText } from "@/lib/search";

export type MovementFilter = "all" | "salida" | "recepcion" | "ajuste";

/**
 * Historial del inventario: cada salida, entrada por compra y ajuste, con
 * de dónde vino (a quién se entregó, qué proveedor, qué motivo), cuánto y
 * cómo quedó la existencia. Lo más nuevo arriba.
 */
export function MovementsView({
  movements,
  items,
  categories,
  people,
  suppliers,
  projects,
  initialFilter,
  canAdjust,
}: {
  movements: InventoryMovement[];
  items: InventoryItem[];
  categories: InventoryCategory[];
  people: InventoryPerson[];
  suppliers: Supplier[];
  projects: { id: string; name: string }[];
  initialFilter: MovementFilter;
  canAdjust: boolean;
}) {
  const { ta, lang } = useTa();
  const [filter, setFilter] = React.useState<MovementFilter>(initialFilter);
  const [query, setQuery] = React.useState("");
  const [adjusting, setAdjusting] = React.useState(false);
  const index = useVariantIndex(items);
  const personName = React.useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const supplierName = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const projectName = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  /** De dónde vino el movimiento, en una línea. */
  const detail = React.useCallback(
    (m: InventoryMovement) => {
      if (m.kind === "salida" && m.issue) {
        const who = personName.get(m.issue.employeeId ?? m.issue.contractorId ?? "") ?? "—";
        const where = m.issue.projectId
          ? (projectName.get(m.issue.projectId) ?? "—")
          : m.issue.internalUse
            ? `${ta("dest_internal")} · ${ta(`use_${m.issue.internalUse}`)}`
            : null;
        return where ? `${who} · ${where}` : who;
      }
      if (m.kind === "recepcion") return m.supplierId ? (supplierName.get(m.supplierId) ?? "—") : "—";
      if (m.adjustment) return m.adjustment.notes ? `${ta(`r_${m.adjustment.reason}`)} · ${m.adjustment.notes}` : ta(`r_${m.adjustment.reason}`);
      return "—";
    },
    [personName, projectName, supplierName, ta],
  );

  const shown = React.useMemo(() => {
    const q = normalizeSearchText(query);
    return movements.filter((m) => {
      if (filter !== "all" && m.kind !== filter) return false;
      if (!q) return true;
      return matchesSearch(`${index.get(m.variantId)?.name ?? ""} ${detail(m)} ${m.createdByName ?? ""}`, q);
    });
  }, [movements, filter, query, index, detail]);

  const kindLabel = (k: InventoryMovement["kind"]) => ta(k === "salida" ? "mov_kind_out" : k === "recepcion" ? "mov_kind_in" : "mov_kind_adj");

  return (
    <div className={PAGE_CLASS}>
      <PageHeader
        back={{ href: "/almacen", label: ta("stock_title") }}
        title={ta("mov_title")}
        subtitle={ta("mov_subtitle")}
        action={
          canAdjust && (
            <Button size="sm" onClick={() => setAdjusting(true)}>
              <SlidersHorizontal className="size-3.5" />
              {ta("adjust")}
            </Button>
          )
        }
      />

      <ListToolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={ta("mov_search_ph")} />
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: ta("filter_all") },
            { value: "salida", label: ta("mov_filter_out") },
            { value: "recepcion", label: ta("mov_filter_in") },
            { value: "ajuste", label: ta("mov_filter_adj") },
          ]}
        />
      </ListToolbar>

      {shown.length === 0 ? (
        <EmptyBox>{movements.length === 0 ? ta("mov_empty") : ta("no_results")}</EmptyBox>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {shown.map((m) => {
            const ref = index.get(m.variantId);
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-3.5">
                <ItemThumb path={ref?.item.photoPath ?? null} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{ref?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium">{kindLabel(m.kind)}</span> · {detail(m)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatDateCompact(lang, m.movedOn)}
                    {m.createdByName && ` · ${m.createdByName}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold tabular-nums ${m.qty < 0 ? "text-destructive" : "text-success"}`}>
                    {m.qty > 0 ? "+" : ""}
                    {formatQty(m.qty, lang)}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {ta("mov_left")} {qtyWithUnit(m.stockAfter, ref?.item.unit, lang)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canAdjust && <AdjustmentDialog open={adjusting} onOpenChange={setAdjusting} items={items} categories={categories} />}
    </div>
  );
}
