"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ChevronRight, Plus, Search, X } from "lucide-react";

import type { InventoryCategory, InventoryItem, OrderDelivery, PurchaseOrder, PurchaseRequest, Supplier } from "@/types/almacen";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatQty, parseQty } from "@/lib/almacen/inventory";
import { createPurchaseOrderAction, updatePurchaseRequestAction } from "../actions";
import { EmptyBox, PageHeader, QtyInput, qtyWithUnit, useTa, useVariantIndex, type VariantRef } from "../shared";
import { StatusBadge, requestName } from "./common";
import { RequestDialog } from "./request-dialog";
import { BuildOrderDialog } from "./build-order-dialog";
import { OrderDialog } from "./order-dialog";
import { DeliveryBadge, MapsButton, MarkOrderedButton, OrderMessageDialog } from "./order-message";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import type { OrderMessageLine } from "@/lib/almacen/inventory";
import { SectionHeader, SubTabs } from "@/components/shared/page-header";

type Project = { id: string; name: string; active: boolean };
/** Las etapas de una compra: cada cosa aparece en una sola. */
type Tab = "porpedir" | "encamino" | "historial";


/**
 * Almacén → Compras, por etapa: **Por pedir** (solicitudes pendientes;
 * Compras las agrupa por proveedor y con «Pedido ✓» las pasa a En camino:
 * por detrás se crea el pedido con proveedor y fecha), **En camino**
 * (pedidos abiertos; Almacén recibe) e **Historial** (recibidos, cancelados
 * y solicitudes canceladas). La factura y los montos son opcionales, dentro
 * del pedido, solo con Compras. Sin Almacén, cada quien ve sus solicitudes.
 */
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
  const [tab, setTab] = React.useState<Tab>("porpedir");
  const [requesting, setRequesting] = React.useState(false);
  const [building, setBuilding] = React.useState<{ supplierId: string | null; requestIds: string[] } | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [messaging, setMessaging] = React.useState<{ supplier: Supplier | null; lines: OrderMessageLine[] } | null>(null);
  const index = useVariantIndex(items);
  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const projectName = React.useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const order = orderId ? (orders.find((o) => o.id === orderId) ?? null) : null;
  const pending = requests.filter((r) => r.status === "pendiente");
  const open = orders.filter((o) => o.status === "pedido" || o.status === "parcial").sort((a, b) => a.orderedOn.localeCompare(b.orderedOn));
  const count = (n: number) => (n > 0 ? <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{n}</span> : undefined);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
      <PageHeader
        title={ta("purchases_title")}
        subtitle={canPurchase ? ta("purchases_subtitle") : canWarehouse ? ta("warehouse_requests_subtitle") : ta("my_requests_subtitle")}
        action={
          <Button size="sm" onClick={() => setRequesting(true)}>
            <Plus className="size-3.5" />
            {ta("new_request")}
          </Button>
        }
      />

      {canWarehouse ? (
        <>
          <SubTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "porpedir", label: ta("tab_to_order"), badge: count(pending.length) },
              { value: "encamino", label: ta("tab_in_transit"), badge: count(open.length) },
              { value: "historial", label: ta("history") },
            ]}
          />
          {tab === "porpedir" &&
            (canPurchase ? (
              <ToOrder
                requests={pending}
                index={index}
                supplierById={supplierById}
                projectName={projectName}
                onPick={(supplierId, requestIds) => setBuilding({ supplierId, requestIds })}
                onMessage={(supplierId, picked) =>
                  setMessaging({
                    supplier: supplierId ? (supplierById.get(supplierId) ?? null) : null,
                    lines: picked.map((r) => ({ name: requestName(r, index), qty: r.qty, unit: r.unit })),
                  })
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">{ta("to_order_hint")}</p>
                <RequestsTable requests={pending} index={index} projectName={projectName} showWho canCancel={(r) => r.createdBy === userId} />
              </div>
            ))}
          {tab === "encamino" && (
            <InTransit orders={open} requests={requests} index={index} supplierById={supplierById} canWarehouse={canWarehouse} onOpen={setOrderId} />
          )}
          {tab === "historial" && (
            <History orders={orders} requests={requests} index={index} supplierById={supplierById} projectName={projectName} onOpen={setOrderId} />
          )}
        </>
      ) : (
        <MyRequests requests={requests.filter((r) => r.createdBy === userId)} index={index} projectName={projectName} />
      )}

      <OrderMessageDialog draft={messaging} onClose={() => setMessaging(null)} />
      <RequestDialog open={requesting} onOpenChange={setRequesting} items={items} categories={categories} projects={projects} />
      <BuildOrderDialog
        draft={building}
        requests={requests}
        index={index}
        suppliers={suppliers}
        onClose={() => setBuilding(null)}
        onCreated={() => {
          setBuilding(null);
          toast.success(ta("moved_in_transit"));
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

// ── Por pedir (Compras): pendientes agrupadas por proveedor ─────────────

function ToOrder({
  requests,
  index,
  supplierById,
  projectName,
  onPick,
  onMessage,
}: {
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  supplierById: Map<string, Supplier>;
  projectName: Map<string, string>;
  /** Abrir el diálogo para elegir o cambiar el proveedor. */
  onPick: (supplierId: string | null, requestIds: string[]) => void;
  /** Paso 1: el mensaje del pedido para el proveedor. */
  onMessage: (supplierId: string, picked: PurchaseRequest[]) => void;
}) {
  const { ta, lang } = useTa();
  const [unchecked, setUnchecked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);

  const groups = React.useMemo(() => {
    const map = new Map<string, PurchaseRequest[]>();
    for (const r of requests) {
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

  // Con proveedor conocido pasa directo a En camino; sin proveedor, primero se elige.
  async function markOrdered(supplierId: string, picked: string[], delivery: OrderDelivery) {
    setBusy(supplierId);
    const res = await createPurchaseOrderAction(supplierId, picked, null, delivery);
    setBusy(null);
    if (res.ok) toast.success(ta("moved_in_transit"));
    else toast.error(res.error);
  }

  if (groups.length === 0) return <EmptyBox>{ta("requests_empty")}</EmptyBox>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{ta("to_order_hint_purchase")}</p>
      {groups.map(([supplierId, list]) => {
        const pickedRequests = list.filter((r) => !unchecked.has(r.id));
        const picked = pickedRequests.map((r) => r.id);
        return (
          <section key={supplierId || "none"} className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <h3 className="min-w-0 truncate font-semibold">{supplierId ? supplierById.get(supplierId)?.name : ta("no_supplier")}</h3>
              {supplierId && (
                <button
                  type="button"
                  disabled={picked.length === 0}
                  onClick={() => onPick(supplierId, picked)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {ta("change_supplier")}
                </button>
              )}
            </header>
            <ul>
              {list.map((r) => (
                <PendingRow key={r.id} r={r} index={index} projectName={projectName} checked={!unchecked.has(r.id)} onToggle={() => toggle(r.id)} lang={lang} />
              ))}
            </ul>
            {/* Paso 1: WhatsApp al proveedor. Paso 2 (confirmado y pagado): «Pedido ✓» → En camino. */}
            <footer className="grid grid-cols-2 gap-2 border-t border-border bg-muted/20 px-3.5 py-2.5 sm:flex sm:justify-end">
              {supplierId ? (
                <>
                  <Button size="sm" variant="outline" disabled={picked.length === 0} onClick={() => onMessage(supplierId, pickedRequests)}>
                    <WhatsAppIcon className="size-4" />
                    {ta("whatsapp_short")}
                  </Button>
                  <MarkOrderedButton count={picked.length} disabled={picked.length === 0 || busy === supplierId} onPick={(d) => void markOrdered(supplierId, picked, d)} />
                </>
              ) : (
                // Sin proveedor: primero se elige (y ahí mismo cómo llega).
                <Button size="sm" className="col-span-2" disabled={picked.length === 0} onClick={() => onPick(null, picked)}>
                  {ta("mark_ordered")} ({picked.length})
                </Button>
              )}
            </footer>
          </section>
        );
      })}
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
    <li className="grid grid-cols-[24px_1fr_96px_28px] items-center gap-2 border-b border-border px-3.5 py-2 text-sm last:border-0">
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
  return <RequestsTable requests={requests} index={index} projectName={projectName} canCancel={() => true} />;
}

function RequestsTable({
  requests,
  index,
  projectName,
  showWho,
  canCancel,
}: {
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  projectName: Map<string, string>;
  showWho?: boolean;
  /** Puede cancelar esta solicitud si sigue pendiente (las propias). */
  canCancel?: (r: PurchaseRequest) => boolean;
}) {
  const { ta, lang } = useTa();
  if (requests.length === 0) return <EmptyBox>{ta("requests_empty")}</EmptyBox>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm sm:min-w-[560px]">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3.5 py-2 text-left font-medium">{ta("f_what")}</th>
            <th className="px-3 py-2 text-right font-medium">{ta("qty")}</th>
            {showWho && <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">{ta("requested_by")}</th>}
            <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">{ta("date")}</th>
            <th className="px-3.5 py-2 text-right font-medium">{ta("col_status")}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="max-w-0 px-3.5 py-2.5">
                <span className="block truncate font-medium">{requestName(r, index)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[r.projectId ? projectName.get(r.projectId) : null, r.auto ? null : r.reason].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{qtyWithUnit(r.qty, r.unit, lang)}</td>
              {showWho && <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{r.auto ? ta("auto") : (r.createdByName ?? "—")}</td>}
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground sm:table-cell">{formatDateCompact(lang, todayInPanama(new Date(r.createdAt)))}</td>
              <td className="px-3.5 py-2.5 text-right">
                <span className="inline-flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {canCancel?.(r) && r.status === "pendiente" && (
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

// ── En camino ───────────────────────────────────────────────────────────

/** "Pedido hoy", "Pedido ayer", "Pedido hace 6 días". */
function useOrderedAgo() {
  const { ta } = useTa();
  const today = todayInPanama();
  return (orderedOn: string) => {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${orderedOn}T00:00:00Z`)) / 86_400_000);
    return days <= 0 ? ta("ordered_today") : days === 1 ? ta("ordered_one_day") : ta("ordered_days_ago", { n: days });
  };
}

function InTransit({
  orders,
  requests,
  index,
  supplierById,
  canWarehouse,
  onOpen,
}: {
  orders: PurchaseOrder[];
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  supplierById: Map<string, Supplier>;
  canWarehouse: boolean;
  onOpen: (id: string) => void;
}) {
  const { ta, lang } = useTa();
  const ago = useOrderedAgo();
  // Quién pidió cada renglón (las solicitudes que se juntaron en él).
  const whoByLine = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of requests) {
      if (!r.orderLineId) continue;
      const who = r.auto ? ta("auto") : (r.createdByName ?? "");
      if (who) map.set(r.orderLineId, [...new Set([...(map.get(r.orderLineId) ?? []), who])]);
    }
    return map;
  }, [requests, ta]);

  if (orders.length === 0) return <EmptyBox>{ta("in_transit_empty")}</EmptyBox>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{ta("in_transit_hint")}</p>
      {orders.map((o) => (
        <section key={o.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                {supplierById.get(o.supplierId)?.name ?? "—"}
                <DeliveryBadge delivery={o.delivery} />
                {o.status === "parcial" && <StatusBadge status={o.status} />}
              </h3>
              <p className="text-xs text-muted-foreground">
                {ago(o.orderedOn)} · {formatDateCompact(lang, o.orderedOn)}
                {o.createdByName ? ` · ${o.createdByName}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Para el mensajero: un toque y va a Google Maps (ubicación del Directorio). */}
              {o.delivery === "retiro" && <MapsButton supplier={supplierById.get(o.supplierId)} />}
              <Button size="sm" variant={canWarehouse ? "default" : "outline"} onClick={() => onOpen(o.id)}>
                {canWarehouse ? ta("receive") : ta("view_order")}
              </Button>
            </div>
          </header>
          <ul>
            {o.lines.map((l) => {
              const who = whoByLine.get(l.id);
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate">{requestName(l, index)}</span>
                    {who && <span className="block truncate text-xs text-muted-foreground">{who.join(", ")}</span>}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {l.receivedQty > 0
                      ? ta("received_of", { a: formatQty(l.receivedQty, lang), b: qtyWithUnit(l.qty, l.unit, lang) })
                      : qtyWithUnit(l.qty, l.unit, lang)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── Historial ───────────────────────────────────────────────────────────

function History({
  orders,
  requests,
  index,
  supplierById,
  projectName,
  onOpen,
}: {
  orders: PurchaseOrder[];
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  supplierById: Map<string, Supplier>;
  projectName: Map<string, string>;
  onOpen: (id: string) => void;
}) {
  const { ta, lang } = useTa();
  const [q, setQ] = React.useState("");
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = norm(q.trim());
  const closed = orders
    .filter((o) => o.status === "recibido" || o.status === "cancelado")
    .filter((o) => !needle || norm([supplierById.get(o.supplierId)?.name ?? "", ...o.lines.map((l) => requestName(l, index))].join(" ")).includes(needle))
    .sort((a, b) => b.orderedOn.localeCompare(a.orderedOn));
  const cancelled = requests
    .filter((r) => r.status === "cancelado")
    .filter((r) => !needle || norm(requestName(r, index)).includes(needle));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{ta("history_hint")}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ta("history_search")} className="pl-9" />
      </div>
      {closed.length === 0 && cancelled.length === 0 ? (
        <EmptyBox>{ta("history_empty")}</EmptyBox>
      ) : (
        <>
          {closed.length > 0 && (
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {closed.map((o) => (
                <li key={o.id} className="border-b border-border last:border-0">
                  <button type="button" onClick={() => onOpen(o.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/30">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{supplierById.get(o.supplierId)?.name ?? "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDateCompact(lang, o.orderedOn)} · {o.lines.map((l) => requestName(l, index)).join(", ")}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cancelled.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader title={ta("cancelled_requests")} />
              <RequestsTable requests={cancelled} index={index} projectName={projectName} showWho />
            </section>
          )}
        </>
      )}
    </div>
  );
}
