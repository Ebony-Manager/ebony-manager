"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { InventoryCategory, InventoryItem, Supplier } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatQty, formatUnitCost, stockStatus } from "@/lib/almacen/inventory";
import { ItemDialog } from "./item-dialog";
import { EmptyBox, ItemThumb, PageHeader, SearchBox, StockBadge, qtyWithUnit, useTa } from "./shared";

type Filter = "all" | "low" | "out";

/**
 * Existencias: una fila por variante activa, con su mínimo y "pedir hasta".
 * Los filtros "bajo el mínimo" y "sin existencia" son lo que hay que pedir.
 */
export function StockView({
  items,
  categories,
  suppliers,
  canEdit,
  canCosts,
}: {
  items: InventoryItem[];
  categories: InventoryCategory[];
  suppliers: Supplier[];
  canEdit: boolean;
  canCosts: boolean;
}) {
  const { ta, lang } = useTa();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editing, setEditing] = React.useState<InventoryItem | "new" | null>(null);

  const catName = React.useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const catOrder = React.useMemo(() => new Map(categories.map((c) => [c.id, c.sortOrder])), [categories]);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.active && (category === "all" || i.categoryId === category))
      .sort((a, b) => (catOrder.get(a.categoryId ?? "") ?? 99) - (catOrder.get(b.categoryId ?? "") ?? 99) || a.name.localeCompare(b.name, "es"))
      .flatMap((item) => item.variants.filter((v) => v.active).map((variant) => ({ item, variant })))
      .filter(({ item, variant }) => !q || `${item.name} ${variant.label}`.toLowerCase().includes(q))
      .filter(({ variant }) => {
        const s = stockStatus(variant);
        return filter === "all" || (filter === "out" ? s === "sin" : s !== "ok");
      });
  }, [items, query, category, filter, catOrder]);

  const totalValueCents = React.useMemo(
    () =>
      items
        .filter((i) => i.active)
        .flatMap((i) => i.variants)
        .reduce((sum, v) => sum + (v.unitCostCents != null && v.stockQty > 0 ? v.stockQty * v.unitCostCents : 0), 0),
    [items],
  );

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <PageHeader
        title={ta("stock_title")}
        subtitle={ta("stock_subtitle")}
        action={
          canEdit && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" />
              {ta("new_item")}
            </Button>
          )
        }
      />

      {canCosts && items.length > 0 && (
        <div className="flex flex-col gap-0.5 self-start border border-ink-900/8 bg-card px-4 py-3">
          <span className="text-xs text-muted-foreground">{ta("inventory_value")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCents(Math.round(totalValueCents))}</span>
          <span className="text-xs text-muted-foreground">{ta("value_note")}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-auto min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ta("all_categories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: ta("filter_all") },
            { value: "low", label: ta("filter_low") },
            { value: "out", label: ta("filter_out") },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <EmptyBox>{ta("stock_empty")}</EmptyBox>
      ) : rows.length === 0 ? (
        <EmptyBox>{ta("no_results")}</EmptyBox>
      ) : (
        <>
          {/* Celular: tarjetas. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map(({ item, variant }) => (
              <li key={variant.id}>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex w-full items-start gap-3 border border-ink-900/8 bg-card px-3.5 py-3 text-left"
                >
                  <ItemThumb path={item.photoPath} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{item.name}</span>
                    {variant.label && <span className="block text-xs text-muted-foreground">{variant.label}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {ta("col_min")}: {variant.minQty != null ? formatQty(variant.minQty, lang) : "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{qtyWithUnit(variant.stockQty, item.unit, lang)}</span>
                    <StockBadge variant={variant} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border border-ink-900/8 bg-card sm:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                  <th className="px-3.5 py-2 text-left font-medium">{ta("col_product")}</th>
                  <th className="px-3 py-2 text-right font-medium">{ta("col_stock")}</th>
                  <th className="px-3 py-2 text-right font-medium">{ta("col_min")}</th>
                  <th className="px-3 py-2 text-right font-medium">{ta("col_reorder")}</th>
                  {canCosts && <th className="px-3 py-2 text-right font-medium">{ta("col_cost")}</th>}
                  <th className="px-3.5 py-2 text-right font-medium">{ta("col_status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, variant }) => (
                  <tr key={variant.id} onClick={() => setEditing(item)} className="cursor-pointer border-b border-ink-900/8 last:border-0 hover:bg-muted/30">
                    <td className="min-w-[260px] px-3.5 py-2">
                      <span className="flex items-center gap-3">
                        <ItemThumb path={item.photoPath} size={40} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                            {item.name}
                            {item.kind === "devolvible" && <Badge variant="outline">{ta("returnable")}</Badge>}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[variant.label, catName.get(item.categoryId ?? "")].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{qtyWithUnit(variant.stockQty, item.unit, lang)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {variant.minQty != null ? formatQty(variant.minQty, lang) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {variant.reorderQty != null ? formatQty(variant.reorderQty, lang) : "—"}
                    </td>
                    {canCosts && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {variant.unitCostCents != null ? formatUnitCost(variant.unitCostCents) : "—"}
                      </td>
                    )}
                    <td className="px-3.5 py-2.5 text-right">
                      <StockBadge variant={variant} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ItemDialog item={editing} categories={categories} suppliers={suppliers} canEdit={canEdit} canCosts={canCosts} onClose={() => setEditing(null)} />
    </div>
  );
}
