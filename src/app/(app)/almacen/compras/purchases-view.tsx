"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";

import type { InventoryCategory, InventoryItem, PurchaseOrder, PurchaseRequest, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { parseQty } from "@/lib/almacen/inventory";
import { updatePurchaseRequestAction } from "../actions";
import { EmptyBox, PageHeader, QtyInput, qtyWithUnit, useTa, useVariantIndex, type VariantRef } from "../shared";
import { StatusBadge, requestName } from "./common";
import { RequestDialog } from "./request-dialog";
import { BuildOrderDialog } from "./build-order-dialog";
import { OrderDialog } from "./order-dialog";

type Project = { id: string; name: string; active: boolean };
type Tab = "requests" | "orders";
type ReqFilter = "pendiente" | "pedido" | "recibido" | "cancelado" | "all";


export function PurchasesView({
  userId,
  requests,
  items,
  categories,
  suppliers,
  orders,
  projects,
  canWarehouse,
  canPurchase,
  canCosts,
}: {
  userId: string;
  requests: PurchaseRequest[];
  items: InventoryItem[];
  categories: InventoryCategory[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  projects: Project[];
  canWarehouse: boolean;
  canPurchase: boolean;
  canCosts: boolean;
}) {
  const { ta } = useTa();
  const [tab, setTab] = React.useState<Tab>("requests");
  const [requesting, setRequesting] = React.useState(false);
  const [building, setBuilding] = React.useState<{ supplierId: string | null; requestIds: string[] } | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const index = useVariantIndex(items);
  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const projectName = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const order = orderId ? (orders.find((o) => o.id === orderId) ?? null) : null;

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <PageHeader
        title={ta("purchases_title")}
        subtitle={canPurchase ? ta("purchases_subtitle") : ta("my_requests_subtitle")}
        action={
          <Button onClick={() => setRequesting(true)}>
            <Plus className="size-4" />
            {ta("new_request")}
          </Button>
        }
      />

      {canWarehouse && (
        <div className="flex gap-5 border-b border-ink-900/8">
          {(["requests", "orders"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium ${tab === k ? "border-walnut text-walnut" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {k === "requests" ? ta("tab_requests") : ta("tab_orders")}
            </button>
          ))}
        </div>
      )}

      {tab === "requests" ? (
        canPurchase ? (
          <PurchasingRequests
            requests={requests}
            index={index}
            supplierById={supplierById}
            projectName={projectName}
            onBuild={(supplierId, requestIds) => setBuilding({ supplierId, requestIds })}
          />
        ) : (
          <MyRequests requests={requests.filter((r) => r.createdBy === userId)} index={index} projectName={projectName} />
        )
      ) : (
        <OrdersList orders={orders} supplierById={supplierById} onOpen={setOrderId} />
      )}

      <RequestDialog open={requesting} onOpenChange={setRequesting} items={items} categories={categories} projects={projects} />
      <BuildOrderDialog
        draft={building}
        requests={requests}
        index={index}
        suppliers={suppliers}
        onClose={() => setBuilding(null)}
        onCreated={(id) => {
          setBuilding(null);
          setTab("orders");
          setOrderId(id);
        }}
      />
      <OrderDialog
        order={order}
        supplier={order ? (supplierById.get(order.supplierId) ?? null) : null}
        index={index}
        canWarehouse={canWarehouse}
        canPurchase={canPurchase}
        canCosts={canCosts}
        onClose={() => setOrderId(null)}
      />
    </div>
  );
}

function cancelRequest(id: string, ta: ReturnType<typeof useTa>["ta"]) {
  void updatePurchaseRequestAction(id, { status: "cancelado" }).then((res) =>
    res.ok ? toast.success(ta("request_cancelled")) : toast.error(res.error),
  );
}

// ── Compras: pendientes agrupadas por proveedor ─────────────────────────

function PurchasingRequests({
  requests,
  index,
  supplierById,
  projectName,
  onBuild,
}: {
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  supplierById: Map<string, Supplier>;
  projectName: Map<string, string>;
  onBuild: (supplierId: string | null, requestIds: string[]) => void;
}) {
  const { ta, lang } = useTa();
  const [filter, setFilter] = React.useState<ReqFilter>("pendiente");
  const [unchecked, setUnchecked] = React.useState<Set<string>>(new Set());

  const groups = React.useMemo(() => {
    const map = new Map<string, PurchaseRequest[]>();
    for (const r of requests.filter((x) => x.status === "pendiente")) {
      const ref = r.variantId ? index.get(r.variantId) : undefined;
      const primary = ref?.item.suppliers.find((s) => s.isPrimary) ?? ref?.item.suppliers[0];
      const key = primary && supplierById.has(primary.supplierId) ? primary.supplierId : "";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort(([a], [b]) => (a ? (supplierById.get(a)?.name ?? "") : "zzz").localeCompare(b ? (supplierById.get(b)?.name ?? "") : "zzz"));
  }, [requests, index, supplierById]);

  const toggle = (id: string) =>
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <SegmentedFilter
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pendiente", label: ta("st_pendiente") },
          { value: "pedido", label: ta("st_pedido") },
          { value: "recibido", label: ta("st_recibido") },
          { value: "cancelado", label: ta("st_cancelado") },
          { value: "all", label: ta("filter_all") },
        ]}
      />

      {filter === "pendiente" ? (
        groups.length === 0 ? (
          <EmptyBox>{ta("requests_empty")}</EmptyBox>
        ) : (
          groups.map(([supplierId, list]) => {
            const picked = list.filter((r) => !unchecked.has(r.id)).map((r) => r.id);
            return (
              <section key={supplierId || "none"} className="border border-ink-900/8 bg-card">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/8 px-3.5 py-2.5">
                  <h3 className="font-semibold">{supplierId ? supplierById.get(supplierId)?.name : ta("no_supplier")}</h3>
                  <Button size="sm" disabled={picked.length === 0} onClick={() => onBuild(supplierId || null, picked)}>
                    {ta("build_order")} ({picked.length})
                  </Button>
                </header>
                <ul>
                  {list.map((r) => (
                    <PendingRow
                      key={r.id}
                      r={r}
                      index={index}
                      projectName={projectName}
                      checked={!unchecked.has(r.id)}
                      onToggle={() => toggle(r.id)}
                      lang={lang}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )
      ) : (
        <RequestsTable requests={requests.filter((r) => filter === "all" || r.status === filter)} index={index} projectName={projectName} showWho />
      )}
    </div>
  );
}

function PendingRow({
  r,
  index,
  projectName,
  checked,
  onToggle,
  lang,
}: {
  r: PurchaseRequest;
  index: Map<string, VariantRef>;
  projectName: Map<string, string>;
  checked: boolean;
  onToggle: () => void;
  lang: "es" | "en";
}) {
  const { ta } = useTa();
  const [qty, setQty] = React.useState(String(r.qty));
  const ref = r.variantId ? index.get(r.variantId) : undefined;

  function saveQty() {
    const n = parseQty(qty);
    if (n == null || n <= 0 || n === r.qty) return setQty(String(r.qty));
    void updatePurchaseRequestAction(r.id, { qty: n }).then((res) => (res.ok ? toast.success(ta("saved")) : toast.error(res.error)));
  }

  return (
    <li className="grid grid-cols-[24px_1fr_96px_28px] items-center gap-2 border-b border-ink-900/8 px-3.5 py-2 text-sm last:border-0">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={requestName(r, index)} />
      <div className="min-w-0">
        <span className="block truncate font-medium">{requestName(r, index)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[
            ref ? `${ta("stock_now")}: ${qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}` : ta("free_item"),
            r.auto ? ta("auto") : r.createdByName,
            r.projectId ? projectName.get(r.projectId) : null,
            r.reason && !r.auto ? r.reason : null,
            formatDateCompact(lang, todayInPanama(new Date(r.createdAt))),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <QtyInput value={qty} onChange={setQty} onBlur={saveQty} aria-label={ta("qty")} />
      <ConfirmButton
        iconOnly
        icon={X}
        iconClassName="size-4"
        label={ta("cancel_request")}
        confirmLabel={ta("cancel_request_confirm")}
        onConfirm={() => cancelRequest(r.id, ta)}
        className="min-h-7 min-w-7"
      />
    </li>
  );
}

// ── Mis solicitudes (sin Compras) ───────────────────────────────────────

function MyRequests({ requests, index, projectName }: { requests: PurchaseRequest[]; index: Map<string, VariantRef>; projectName: Map<string, string> }) {
  const { ta } = useTa();
  if (requests.length === 0) return <EmptyBox>{ta("requests_empty")}</EmptyBox>;
  return <RequestsTable requests={requests} index={index} projectName={projectName} canCancelPending />;
}

function RequestsTable({
  requests,
  index,
  projectName,
  showWho,
  canCancelPending,
}: {
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  projectName: Map<string, string>;
  showWho?: boolean;
  canCancelPending?: boolean;
}) {
  const { ta, lang } = useTa();
  if (requests.length === 0) return <EmptyBox>{ta("requests_empty")}</EmptyBox>;
  return (
    <div className="overflow-x-auto border border-ink-900/8 bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
            <th className="px-3.5 py-2 text-left font-medium">{ta("f_what")}</th>
            <th className="px-3 py-2 text-right font-medium">{ta("qty")}</th>
            {showWho && <th className="px-3 py-2 text-left font-medium">{ta("requested_by")}</th>}
            <th className="px-3 py-2 text-left font-medium">{ta("date")}</th>
            <th className="px-3.5 py-2 text-right font-medium">{ta("col_status")}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-ink-900/8 last:border-0">
              <td className="max-w-0 px-3.5 py-2.5">
                <span className="block truncate font-medium">{requestName(r, index)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[r.projectId ? projectName.get(r.projectId) : null, r.auto ? null : r.reason].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{qtyWithUnit(r.qty, r.unit, lang)}</td>
              {showWho && <td className="px-3 py-2.5 text-muted-foreground">{r.auto ? ta("auto") : (r.createdByName ?? "—")}</td>}
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateCompact(lang, todayInPanama(new Date(r.createdAt)))}</td>
              <td className="px-3.5 py-2.5 text-right">
                <span className="inline-flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {canCancelPending && r.status === "pendiente" && (
                    <ConfirmButton
                      iconOnly
                      icon={X}
                      iconClassName="size-4"
                      label={ta("cancel_request")}
                      confirmLabel={ta("cancel_request_confirm")}
                      onConfirm={() => cancelRequest(r.id, ta)}
                    />
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pedidos ─────────────────────────────────────────────────────────────

function OrdersList({ orders, supplierById, onOpen }: { orders: PurchaseOrder[]; supplierById: Map<string, Supplier>; onOpen: (id: string) => void }) {
  const { ta, lang } = useTa();
  if (orders.length === 0) return <EmptyBox>{ta("orders_empty")}</EmptyBox>;
  return (
    <div className="overflow-x-auto border border-ink-900/8 bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
            <th className="px-3.5 py-2 text-left font-medium">{ta("col_supplier")}</th>
            <th className="px-3 py-2 text-left font-medium">{ta("date")}</th>
            <th className="px-3 py-2 text-right font-medium">{ta("col_lines")}</th>
            <th className="px-3 py-2 text-left font-medium">{ta("col_invoice")}</th>
            <th className="px-3.5 py-2 text-right font-medium">{ta("col_status")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => onOpen(o.id)} className="cursor-pointer border-b border-ink-900/8 last:border-0 hover:bg-muted/30">
              <td className="px-3.5 py-2.5 font-semibold">{supplierById.get(o.supplierId)?.name ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateCompact(lang, o.orderedOn)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{o.lines.length}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{o.invoiceRef ?? "—"}</td>
              <td className="px-3.5 py-2.5 text-right">
                <StatusBadge status={o.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
