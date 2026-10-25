"use client";

import * as React from "react";
import { AlertTriangle, ArrowUpFromLine, Boxes, CircleDollarSign, Folder, PackageX, ShoppingCart, Snowflake, Truck, User } from "lucide-react";

import type { InventoryItem, InventoryMovement, InventoryPerson, PurchaseOrder, Supplier } from "@/types/almacen";
import { KpiCard } from "@/components/shared/kpi-card";
import { MonthBars } from "@/components/shared/month-bars";
import { RankList } from "@/components/shared/rank-list";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, Stepper } from "@/components/shared/page-header";
import { idleStock, spendBySupplier, summarizeConsumption } from "@/lib/almacen/summary";
import { formatQty, stockStatus, unitLabel } from "@/lib/almacen/inventory";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { PageHeader, useTa, useVariantIndex } from "../shared";

type View = "consumo" | "stock" | "compras";
type Scope = "month" | "year";

/**
 * Almacén → Resumen, con el mismo esqueleto que el de Personal: vista,
 * período, tarjetas, gráfico por mes y rankings.
 * - Consumo: salidas, lo más usado, por proyecto y quién retira.
 * - Stock: sin stock, bajo stock y lo que no se mueve (60 días).
 * - Compras: pedidos y gasto por proveedor.
 */
export function AlmacenSummaryView({
  movements,
  items,
  people,
  projects,
  suppliers,
  orders,
}: {
  movements: InventoryMovement[];
  items: InventoryItem[];
  people: InventoryPerson[];
  projects: { id: string; name: string }[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
}) {
  const { ta, lang } = useTa();
  const now = currentPeriod();
  const [view, setView] = React.useState<View>("consumo");
  const [scope, setScope] = React.useState<Scope>("month");
  const [year, setYear] = React.useState(now.year);
  const [month, setMonth] = React.useState(now.month);
  const index = useVariantIndex(items);
  const period = { year, month: scope === "month" ? month : null };

  const personName = new Map(people.map((p) => [p.id, p.name]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const qtyText = (variantId: string, qty: number) => `${formatQty(qty, lang)} ${unitLabel(index.get(variantId)?.item.unit, qty, lang)}`;
  const projectLabel = (key: string) =>
    key === "none" ? "—" : key.startsWith("uso:") ? `${ta("dest_internal")} · ${ta(`use_${key.slice(4)}` as never)}` : (projectName.get(key) ?? "—");

  const consumption = summarizeConsumption(movements, items, period);
  const monthly = Array.from({ length: 12 }, (_, i) => summarizeConsumption(movements, items, { year, month: i + 1 }).issues);
  const idle = idleStock(movements, items, todayInPanama());
  const variants = items.filter((i) => i.active).flatMap((i) => i.variants.filter((v) => v.active));
  const out = variants.filter((v) => stockStatus(v) === "sin");
  const low = variants.filter((v) => stockStatus(v) === "bajo");
  const idleValue = idle.reduce((s, r) => {
    const c = index.get(r.variantId)?.variant.unitCostCents;
    return c == null ? s : s + Math.round(r.stockQty * c);
  }, 0);
  const anyCost = variants.some((v) => v.unitCostCents != null);
  const spend = spendBySupplier(orders, period);
  const spendTotal = spend.reduce((s, r) => s + (r.totalCents ?? 0), 0);
  const anySpend = spend.some((r) => r.totalCents != null);

  const shiftMonth = (d: -1 | 1) => {
    const m = month + d;
    if (m < 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth(m);
  };
  const more = { moreLabel: ta("sum_see_all"), lessLabel: ta("sum_see_less") };

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={ta("sum_title")} subtitle={ta("sum_subtitle")} />

      <SegmentedFilter
        fill
        value={view}
        onChange={setView}
        options={[
          { value: "consumo", label: ta("sum_view_consumo") },
          { value: "stock", label: ta("sum_view_stock") },
          { value: "compras", label: ta("sum_view_compras") },
        ]}
      />

      {view !== "stock" && (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedFilter
            value={scope}
            onChange={setScope}
            options={[
              { value: "month", label: ta("sum_scope_month") },
              { value: "year", label: ta("sum_scope_year") },
            ]}
          />
          {scope === "month" ? (
            <Stepper label={`${monthLabel(lang, month)} ${year}`} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} className="[&>span]:min-w-28" />
          ) : (
            <Stepper label={year} onPrev={() => setYear((y) => y - 1)} onNext={() => setYear((y) => y + 1)} className="[&>span]:min-w-14" />
          )}
        </div>
      )}

      {view === "consumo" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={ArrowUpFromLine} tone="primary" label={ta("sum_kpi_issues")} value={consumption.issues} sublabel={`${consumption.lines} ${ta("sum_lines")}`} />
            <KpiCard icon={Boxes} label={ta("sum_kpi_products")} value={consumption.products} />
            <KpiCard
              icon={CircleDollarSign}
              tone="negative"
              label={ta("sum_kpi_value")}
              value={consumption.valueCents == null ? "—" : formatCents(consumption.valueCents)}
              sublabel={consumption.valueCents == null ? ta("sum_no_costs") : ta("sum_at_last_cost")}
            />
            <KpiCard icon={Folder} label={ta("sum_kpi_projects")} value={consumption.byProject.filter((p) => !p.key.startsWith("uso:") && p.key !== "none").length} />
          </div>

          <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-semibold">
              {ta("sum_chart_issues")} · {year}
            </h3>
            <MonthBars values={monthly} format={(n) => String(n)} lang={lang} selected={scope === "month" ? month : null} onSelect={(m) => {
              setScope("month");
              setMonth(m);
            }} />
          </section>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <RankList
              title={ta("sum_most_used")}
              icon={ArrowUpFromLine}
              items={consumption.mostUsed.map((u) => ({
                key: u.variantId,
                label: index.get(u.variantId)?.name ?? "—",
                value: u.times,
                display: `${u.times}×`,
                sub: qtyText(u.variantId, u.qty),
              }))}
              empty={ta("sum_no_issues")}
              {...more}
            />
            <RankList
              title={ta("sum_by_project")}
              icon={Folder}
              color="var(--payroll-salario)"
              items={consumption.byProject.map((p) => ({ key: p.key, label: projectLabel(p.key), value: p.times, display: `${p.times}` }))}
              empty={ta("sum_no_issues")}
              {...more}
            />
            <RankList
              title={ta("sum_by_person")}
              icon={User}
              color="var(--payroll-bonos)"
              items={consumption.byPerson.map((p) => ({ key: p.key, label: personName.get(p.key) ?? "—", value: p.times, display: `${p.times}` }))}
              empty={ta("sum_no_issues")}
              {...more}
            />
          </div>
        </>
      )}

      {view === "stock" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={PackageX} tone="negative" label={ta("status_out")} value={out.length} />
            <KpiCard icon={AlertTriangle} tone="warning" label={ta("status_low")} value={low.length} />
            <KpiCard icon={Snowflake} tone="primary" label={ta("sum_kpi_idle")} value={idle.length} sublabel={ta("sum_idle_hint")} />
            <KpiCard
              icon={CircleDollarSign}
              tone="warning"
              label={ta("sum_kpi_idle_value")}
              value={anyCost ? formatCents(idleValue) : "—"}
              sublabel={anyCost ? ta("sum_at_last_cost") : ta("sum_no_costs")}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <RankList
              title={ta("sum_idle_list")}
              icon={Snowflake}
              items={idle.map((r) => ({
                key: r.variantId,
                label: index.get(r.variantId)?.name ?? "—",
                value: r.stockQty,
                display: qtyText(r.variantId, r.stockQty),
                sub: r.lastOut ? `${ta("sum_last_out")} ${formatDateCompact(lang, r.lastOut)}` : ta("sum_never_out"),
              }))}
              empty={ta("sum_no_idle")}
              {...more}
            />
            <RankList
              title={ta("sum_low_list")}
              icon={AlertTriangle}
              color="var(--warning)"
              items={[...out, ...low].map((v) => ({
                key: v.id,
                label: index.get(v.id)?.name ?? "—",
                value: Math.max(0, (v.minQty ?? 0) - v.stockQty),
                display: qtyText(v.id, v.stockQty),
                sub: v.minQty != null ? `${ta("col_min")} ${formatQty(v.minQty, lang)}` : undefined,
              }))}
              empty={ta("sum_no_low")}
              {...more}
            />
          </div>
        </>
      )}

      {view === "compras" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard icon={ShoppingCart} tone="primary" label={ta("sum_kpi_orders")} value={spend.reduce((s, r) => s + r.orders, 0)} />
            <KpiCard
              icon={CircleDollarSign}
              tone="negative"
              label={ta("sum_kpi_spend")}
              value={anySpend ? formatCents(spendTotal) : "—"}
              sublabel={anySpend ? ta("sum_invoiced") : ta("sum_no_costs")}
            />
            <KpiCard icon={Truck} label={ta("sum_kpi_suppliers")} value={spend.length} className="col-span-2 lg:col-span-1" />
          </div>
          <RankList
            title={ta("sum_by_supplier")}
            icon={Truck}
            items={spend.map((r) => ({
              key: r.supplierId,
              label: supplierName.get(r.supplierId) ?? "—",
              value: r.totalCents ?? r.orders,
              display: r.totalCents != null ? formatCents(r.totalCents) : `${r.orders}`,
              sub: `${r.orders} ${ta("sum_orders_word")}`,
              href: "/directorio",
            }))}
            empty={ta("sum_no_orders")}
            limit={8}
            {...more}
          />
        </>
      )}
    </div>
  );
}
