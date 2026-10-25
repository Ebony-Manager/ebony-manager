"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Copy, MessageCircle } from "lucide-react";

import type { PurchaseOrder, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatUnitCost, orderMessage, parseQty, whatsappUrl } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { cancelPurchaseOrderAction, receivePurchaseOrderAction, saveOrderInvoiceAction } from "../actions";
import { QtyInput, qtyWithUnit, useTa, type VariantRef } from "../shared";
import { StatusBadge } from "./common";

/**
 * Un pedido: el mensaje para el proveedor (enviarlo directo por WhatsApp o
 * copiarlo), la recepción (Almacén, por partes) y la factura (Compras: número
 * y total de cada línea, de donde sale el costo por unidad).
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

  const [message, setMessage] = React.useState("");
  const [receivedOn, setReceivedOn] = React.useState("");
  const [receive, setReceive] = React.useState<Record<string, string>>({});
  const [invoiceRef, setInvoiceRef] = React.useState("");
  const [totals, setTotals] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const orderId = order?.id;
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir otro pedido. */
  React.useEffect(() => {
    if (!order) return;
    setMessage(
      orderMessage(
        supplier?.contactName ?? null,
        order.lines.map((l) => ({ name: lineName(l), qty: l.qty, unit: l.unit })),
        order.notes,
      ),
    );
    setReceivedOn(todayInPanama(new Date()));
    setReceive(Object.fromEntries(order.lines.map((l) => [l.id, l.qty > l.receivedQty ? String(Math.round((l.qty - l.receivedQty) * 100) / 100) : ""])));
    setInvoiceRef(order.invoiceRef ?? "");
    setTotals(Object.fromEntries(order.lines.map((l) => [l.id, l.totalCents != null ? (l.totalCents / 100).toFixed(2) : ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de pedido (o de su estado).
  }, [orderId, order?.status, order?.invoiceRef]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!order) return <Dialog open={false} />;

  const wa = whatsappUrl(supplier?.whatsapp, message);
  const open = order.status === "pedido" || order.status === "parcial";
  const nothingReceived = order.lines.every((l) => l.receivedQty === 0);

  async function doReceive() {
    const lines = order!.lines
      .map((l) => ({ lineId: l.id, qty: parseQty(receive[l.id] ?? "") ?? 0 }))
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
      const n = parseFloat((totals[l.id] ?? "").replace(",", "."));
      return { lineId: l.id, totalCents: Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null };
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

        {/* Líneas + recepción */}
        <section className="flex flex-col gap-2">
          <div className="overflow-x-auto border border-ink-900/8">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">{ta("product")}</th>
                  <th className="px-3 py-2 text-right font-medium">{ta("col_ordered")}</th>
                  <th className="px-3 py-2 text-right font-medium">{ta("col_received")}</th>
                  {canWarehouse && open && <th className="w-28 px-3 py-2 text-right font-medium">{ta("receive")}</th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.id} className="border-b border-ink-900/8 last:border-0">
                    <td className="px-3 py-2">
                      {lineName(l)}
                      {!l.variantId && <span className="block text-xs text-muted-foreground">{ta("free_item")}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{qtyWithUnit(l.qty, l.unit, lang)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{qtyWithUnit(l.receivedQty, l.unit, lang)}</td>
                    {canWarehouse && open && (
                      <td className="px-3 py-1.5">
                        <QtyInput value={receive[l.id] ?? ""} onChange={(v) => setReceive((r) => ({ ...r, [l.id]: v }))} aria-label={ta("receive")} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canWarehouse && open && (
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs text-muted-foreground">{ta("receive_hint")}</p>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-9 w-40" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} aria-label={ta("date")} />
                <Button size="sm" onClick={doReceive} disabled={busy}>
                  {ta("receive_save")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Mensaje para el proveedor */}
        {canPurchase && order.status !== "cancelado" && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{ta("order_message")}</h3>
            <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} className="text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              {wa ? (
                <Button asChild size="sm">
                  <a href={wa} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    {ta("send_whatsapp")}
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{ta("no_whatsapp")}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success(ta("copied")))}
              >
                <Copy className="size-4" />
                {ta("copy_message")}
              </Button>
            </div>
          </section>
        )}

        {/* Factura */}
        {canCosts && order.status !== "cancelado" && (
          <section className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-semibold">{ta("invoice")}</h3>
              <p className="text-xs text-muted-foreground">{ta("invoice_hint")}</p>
            </div>
            <Field label={ta("f_invoice_ref")}>
              <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} disabled={!canPurchase} />
            </Field>
            <ul className="flex flex-col gap-2">
              {order.lines.map((l) => {
                const n = parseFloat((totals[l.id] ?? "").replace(",", "."));
                const unitCost = Number.isFinite(n) && l.qty > 0 ? (n * 100) / l.qty : null;
                return (
                  <li key={l.id} className="grid grid-cols-[1fr_130px] items-center gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{lineName(l)}</span>
                      {unitCost != null && (
                        <span className="block text-xs text-muted-foreground">
                          {formatUnitCost(unitCost)} / {qtyWithUnit(1, l.unit, lang).replace(/^1 /, "")}
                        </span>
                      )}
                    </span>
                    <MoneyInput
                      value={totals[l.id] ?? ""}
                      onValueChange={(v) => setTotals((t) => ({ ...t, [l.id]: v }))}
                      disabled={!canPurchase}
                      aria-label={ta("line_total")}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {formatCents(
                  order.lines.reduce((sum, l) => {
                    const n = parseFloat((totals[l.id] ?? "").replace(",", "."));
                    return sum + (Number.isFinite(n) ? Math.round(n * 100) : 0);
                  }, 0),
                )}
              </span>
              {canPurchase && (
                <Button size="sm" variant="outline" onClick={doInvoice} disabled={busy}>
                  {ta("save")}
                </Button>
              )}
            </div>
          </section>
        )}

        {canPurchase && order.status === "pedido" && nothingReceived && (
          <div className="flex justify-end border-t border-ink-900/8 pt-3">
            <ConfirmButton label={ta("cancel_order")} confirmLabel={ta("cancel_order_confirm")} onConfirm={() => void doCancel()} disabled={busy} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
