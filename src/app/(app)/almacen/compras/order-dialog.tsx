"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { OrderDelivery, PurchaseOrder, Supplier } from "@/types/almacen";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatQty, formatUnitCost, parseQty, toPacks } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { cancelPurchaseOrderAction, receivePurchaseOrderAction, saveOrderInvoiceAction, setOrderDeliveryAction } from "../actions";
import { QtyInput, useTa, type VariantRef } from "../shared";
import { PurchasePhoto, StatusBadge, packOf, purchaseQtyText } from "./common";
import { DeliveryBadge, MapsButton } from "./order-message";

/** 1250 → "12.50"; 1.25 → "0.0125" (precios de centavos con hasta 4 decimales). */
function centsText(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1) return dollars.toFixed(2);
  // Menos de $1: hasta 4 decimales, pero al menos 2 (0.8 → "0.80", 0.0125 → "0.0125").
  const t = dollars.toFixed(4).replace(/0+$/, "");
  const decimals = t.split(".")[1]?.length ?? 0;
  return decimals < 2 ? dollars.toFixed(2) : t;
}

/**
 * Un pedido: cómo llega (lo traen / por retirar) y, en una sola tabla, lo
 * pedido, lo recibido y lo que recibe el Almacén ahora (por partes). Con
 * Compras o Costos, además el precio por unidad de cada línea (puesto en Por
 * pedir; Compras lo corrige con la factura) y el número de factura. El
 * WhatsApp al proveedor es solo en Por pedir.
 */
export function OrderDialog({
  order,
  supplier,
  index,
  canWarehouse,
  canPurchase,
  canCosts,
  onClose,
}: {
  order: PurchaseOrder | null;
  supplier: Supplier | null;
  index: Map<string, VariantRef>;
  canWarehouse: boolean;
  canPurchase: boolean;
  canCosts: boolean;
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const lineName = React.useCallback((l: { variantId: string | null; description: string }) => (l.variantId && index.get(l.variantId)?.name) || l.description, [index]);
  // Por presentación (rollo, galón): se recibe y se pone precio por presentación; se guarda por unidad.
  const perOf = React.useCallback((variantId: string | null) => packOf(index, variantId)?.qty ?? 1, [index]);

  const [receivedOn, setReceivedOn] = React.useState("");
  const [receive, setReceive] = React.useState<Record<string, string>>({});
  const [invoiceRef, setInvoiceRef] = React.useState("");
  // Precio por unidad de cada línea (texto del campo); el total de la línea = precio × cantidad pedida.
  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const orderId = order?.id;
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir otro pedido. */
  React.useEffect(() => {
    if (!order) return;
    setReceivedOn(todayInPanama(new Date()));
    setReceive(Object.fromEntries(order.lines.map((l) => [l.id, l.qty > l.receivedQty ? String(Math.round(((l.qty - l.receivedQty) / perOf(l.variantId)) * 100) / 100) : ""])));
    setInvoiceRef(order.invoiceRef ?? "");
    setPrices(Object.fromEntries(order.lines.map((l) => [l.id, l.totalCents != null && l.qty > 0 ? centsText((l.totalCents / l.qty) * perOf(l.variantId)) : ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de pedido (o de su estado).
  }, [orderId, order?.status, order?.invoiceRef]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!order) return <Dialog open={false} />;

  async function changeDelivery(d: OrderDelivery) {
    const res = await setOrderDeliveryAction(order!.id, d);
    if (res.ok) toast.success(ta("delivery_saved"));
    else toast.error(res.error);
  }
  const open = order.status === "pedido" || order.status === "parcial";
  const receiving = canWarehouse && open;
  /** Precio por unidad en centavos: lo escrito (Compras) o el de la línea. */
  const unitPrice = (lineId: string): number | null => {
    const line = order!.lines.find((l) => l.id === lineId);
    if (!canPurchase) return line && line.totalCents != null && line.qty > 0 ? line.totalCents / line.qty : null;
    const n = parseFloat((prices[lineId] ?? "").replace(",", "."));
    // Lo escrito es por presentación; el precio por unidad = ese ÷ unidades por presentación.
    return Number.isFinite(n) && n >= 0 ? Math.round((n * 10000) / perOf(line?.variantId ?? null)) / 100 : null;
  };
  const totalCents = order.lines.reduce((sum, l) => {
    const u = unitPrice(l.id);
    return sum + (u != null ? Math.round(u * l.qty) : 0);
  }, 0);
  const invoiceDirty =
    (invoiceRef.trim() || null) !== (order.invoiceRef ?? null) ||
    order.lines.some((l) => {
      const u = unitPrice(l.id);
      const next = u != null ? Math.round(u * l.qty) : null;
      return next !== l.totalCents;
    });
  const nothingReceived = order.lines.every((l) => l.receivedQty === 0);

  async function doReceive() {
    const lines = order!.lines
      .map((l) => ({ lineId: l.id, qty: Math.round((parseQty(receive[l.id] ?? "") ?? 0) * perOf(l.variantId) * 100) / 100 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) return toast.error(ta("nothing_to_receive"));
    setBusy(true);
    const res = await receivePurchaseOrderAction(order!.id, receivedOn || null, lines);
    setBusy(false);
    if (res.ok) toast.success(ta("received_saved"));
    else toast.error(res.error);
  }

  async function doInvoice() {
    const costs = order!.lines.map((l) => {
      const u = unitPrice(l.id);
      return { lineId: l.id, totalCents: u != null ? Math.round(u * l.qty) : null };
    });
    setBusy(true);
    const res = await saveOrderInvoiceAction(order!.id, invoiceRef || null, costs);
    setBusy(false);
    if (res.ok) toast.success(ta("invoice_saved"));
    else toast.error(res.error);
  }

  async function doCancel() {
    setBusy(true);
    const res = await cancelPurchaseOrderAction(order!.id);
    setBusy(false);
    if (res.ok) {
      toast.success(ta("order_cancelled"));
      onClose();
    } else toast.error(res.error);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {ta("order_title")} · {supplier?.name ?? "—"}
            <StatusBadge status={order.status} />
          </DialogTitle>
          <DialogDescription>
            {formatDateCompact(lang, order.orderedOn)}
            {order.createdByName ? ` · ${order.createdByName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Cómo llega: Compras lo cambia mientras está abierto; los demás lo ven. */}
        {canPurchase && open ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{ta("delivery_q")}</span>
            <SegmentedFilter
              value={order.delivery ?? "retiro"}
              onChange={(d) => void changeDelivery(d)}
              options={[
                { value: "retiro", label: ta("delivery_retiro") },
                { value: "entrega", label: ta("delivery_entrega") },
              ]}
            />
          </div>
        ) : (
          order.delivery && (
            <div>
              <DeliveryBadge delivery={order.delivery} />
            </div>
          )
        )}
        {order.delivery === "retiro" && open && <MapsButton supplier={supplier} className="self-start" />}

        {/* Una sola vista: por producto, lo pedido y lo recibido, lo que recibe el
            Almacén ahora y (con Compras o Costos) su precio; abajo, la factura. */}
        <section className="flex flex-col gap-3">
          <ul className="flex flex-col rounded-lg border border-border">
            {order.lines.map((l) => {
              const unit = unitPrice(l.id);
              const done = l.receivedQty >= l.qty;
              const pack = packOf(index, l.variantId);
              const per = pack?.qty ?? 1;
              return (
                <li key={l.id} className="flex flex-col gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-3"><PurchasePhoto variantId={l.variantId} index={index} /><span className="min-w-0 break-words font-medium">{lineName(l)}</span></span>
                      {!l.variantId && <span className="block text-xs text-muted-foreground">{ta("free_item")}</span>}
                    </span>
                    <span className={`shrink-0 text-right text-xs tabular-nums ${done ? "text-success" : "text-muted-foreground"}`}>
                      {ta("received_of", { a: formatQty(pack ? toPacks(l.receivedQty, pack) : l.receivedQty, lang), b: purchaseQtyText(l.qty, l.unit, pack, lang) })}
                    </span>
                  </div>
                  {(receiving || canCosts) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {receiving && !done && (
                        <label className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{ta("col_to_receive")}</span>
                          <span className="w-24">
                            <QtyInput value={receive[l.id] ?? ""} onChange={(v) => setReceive((r) => ({ ...r, [l.id]: v }))} aria-label={ta("receive")} />
                          </span>
                          {pack && <span className="text-xs text-muted-foreground">× {pack.label || formatQty(pack.qty, lang)}</span>}
                        </label>
                      )}
                      {canCosts && (
                        <span className="flex flex-1 items-center justify-end gap-1.5">
                          {canPurchase ? (
                            <span className="w-24" title={ta("f_unit_price")}>
                              <MoneyInput value={prices[l.id] ?? ""} onValueChange={(v) => setPrices((p) => ({ ...p, [l.id]: v }))} aria-label={ta("f_unit_price")} />
                            </span>
                          ) : (
                            <span className="tabular-nums">{unit != null ? formatUnitCost(unit * per) : "—"}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{pack ? ta("price_per_pack", { p: pack.label || formatQty(pack.qty, lang) }) : ta("price_each")}</span>
                          <span className="min-w-20 text-right font-medium tabular-nums">{unit != null ? formatCents(Math.round(unit * l.qty)) : "—"}</span>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {receiving && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{ta("receive_hint")}</p>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 w-40" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} aria-label={ta("date")} />
                <Button size="sm" className="flex-1 sm:flex-none" onClick={doReceive} disabled={busy}>
                  {ta("receive_save")}
                </Button>
              </div>
            </div>
          )}

          {canCosts && order.status !== "cancelado" && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{ta("invoice")}</h3>
                <span className="text-sm font-semibold tabular-nums">{ta("order_total", { t: formatCents(totalCents) })}</span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={ta("f_invoice_ref")}>
                    <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} disabled={!canPurchase} placeholder={canPurchase ? ta("optional") : undefined} />
                  </Field>
                </div>
                {canPurchase && (
                  <Button size="sm" variant="outline" className="h-9" onClick={doInvoice} disabled={busy || !invoiceDirty}>
                    {ta("save_invoice")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {canPurchase && order.status === "pedido" && nothingReceived && (
          <div className="flex justify-end border-t border-border pt-3">
            <ConfirmButton label={ta("cancel_order")} confirmLabel={ta("cancel_order_confirm")} onConfirm={() => void doCancel()} disabled={busy} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
