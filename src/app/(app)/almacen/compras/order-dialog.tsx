"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { LineDestination, OrderDelivery, PurchaseOrder, Supplier } from "@/types/almacen";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatCents } from "@/lib/planilla/payroll-period";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatQty, formatUnitCost, parseQty } from "@/lib/almacen/inventory";
import { Receipt } from "lucide-react";
import { Field } from "../../contratistas/field";
import { FormSection } from "@/components/shared/form-section";
import { ICON } from "@/lib/ui/concepts";
import { cancelPurchaseOrderAction, receivePurchaseOrderAction, saveOrderInvoiceAction, setOrderDeliveryAction } from "../actions";
import { QtyInput, useTa, type VariantRef } from "../shared";
import { LineDestinationTag, PurchasePhoto, PurchaseQty, StatusBadge, packOf } from "./common";
import { DELIVERY_ICON, DeliveryBadge, MapsButton } from "./order-message";

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
  destByLine,
  onClose,
}: {
  order: PurchaseOrder | null;
  supplier: Supplier | null;
  index: Map<string, VariantRef>;
  canWarehouse: boolean;
  canPurchase: boolean;
  canCosts: boolean;
  /** Para qué es cada línea (proyecto, especial), para recibir sin preguntar. */
  destByLine?: Map<string, LineDestination>;
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const lineName = React.useCallback((l: { variantId: string | null; description: string }) => (l.variantId && index.get(l.variantId)?.name) || l.description, [index]);
  // Por presentación (rollo, galón): se recibe y se pone precio por presentación; se guarda por unidad.
  const perOf = React.useCallback((variantId: string | null) => packOf(index, variantId)?.qty ?? 1, [index]);

  const [receivedOn, setReceivedOn] = React.useState("");
  const [receive, setReceive] = React.useState<Record<string, string>>({});
  // Dónde se guarda lo especial que se recibe (pasa al apartado).
  const [locations, setLocations] = React.useState<Record<string, string>>({});
  const [invoiceRef, setInvoiceRef] = React.useState("");
  // Precio por unidad de cada línea (texto del campo); el total de la línea = precio × cantidad pedida.
  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  // Aviso de descartar: solo si se escribió algo sin guardarlo. Recepción y factura se guardan por
  // separado, así que cada una lleva su propia «cómo estaba»: guardar una no borra el aviso de la otra.
  const { isDirty: receiveDirty, markSeeded: markReceiveSeeded } = useFormBaseline(() => JSON.stringify([receivedOn, receive, locations]));
  const { isDirty: invoiceFormDirty, markSeeded: markInvoiceSeeded } = useFormBaseline(() => JSON.stringify([invoiceRef, prices]));
  const isDirty = React.useCallback(() => receiveDirty() || invoiceFormDirty(), [receiveDirty, invoiceFormDirty]);
  const { requestClose, dialog } = useDiscardGuard(isDirty, onClose);

  const orderId = order?.id;
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir otro pedido. */
  React.useEffect(() => {
    if (!order) return;
    markReceiveSeeded();
    markInvoiceSeeded();
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
  // Columnas de la derecha (computadora): Recibir solo mientras se puede recibir; Precio y Total con Compras o Costos.
  const hasCols = receiving || canCosts;
  const smCols =
    receiving && canCosts
      ? "sm:grid-cols-[minmax(0,1fr)_7rem_7.5rem_6rem]"
      : canCosts
        ? "sm:grid-cols-[minmax(0,1fr)_7.5rem_6rem]"
        : receiving
          ? "sm:grid-cols-[minmax(0,1fr)_7rem]"
          : "";

  async function doReceive() {
    const lines = order!.lines
      // Una línea ya completa no se muestra, pero su campo puede guardar lo escrito antes: no se vuelve a mandar.
      .filter((l) => l.receivedQty < l.qty)
      .map((l) => ({ lineId: l.id, qty: Math.round((parseQty(receive[l.id] ?? "") ?? 0) * perOf(l.variantId) * 100) / 100 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) return toast.error(ta("nothing_to_receive"));
    setBusy(true);
    const res = await receivePurchaseOrderAction(
      order!.id,
      receivedOn || null,
      lines.map((l) => ({ ...l, location: destByLine?.get(l.lineId)?.forProject ? locations[l.lineId]?.trim() || null : null })),
    );
    setBusy(false);
    if (res.ok) {
      toast.success(ta("received_saved"));
      const special = lines.filter((l) => destByLine?.get(l.lineId)?.forProject);
      if (special.length) toast(special.every((l) => locations[l.lineId]?.trim()) ? ta("received_special_done") : ta("received_special"), { icon: "📦", duration: 7000 });
      markReceiveSeeded(); // lo recibido ya no cuenta como cambio (la factura sigue igual)
    } else toast.error(res.error);
  }

  async function doInvoice() {
    const costs = order!.lines.map((l) => {
      const u = unitPrice(l.id);
      return { lineId: l.id, totalCents: u != null ? Math.round(u * l.qty) : null };
    });
    setBusy(true);
    const res = await saveOrderInvoiceAction(order!.id, invoiceRef || null, costs);
    setBusy(false);
    if (res.ok) {
      toast.success(ta("invoice_saved"));
      markInvoiceSeeded();
    } else toast.error(res.error);
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
    <Dialog open onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto lg:max-w-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          <Field label={ta("delivery_q")}>
            <SegmentedFilter
              value={order.delivery ?? "retiro"}
              onChange={(d) => void changeDelivery(d)}
              options={[
                { value: "retiro", label: ta("delivery_retiro"), icon: DELIVERY_ICON.retiro },
                { value: "entrega", label: ta("delivery_entrega"), icon: DELIVERY_ICON.entrega },
              ]}
            />
          </Field>
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
            {/* Computadora: una fila por producto (nombre a la izquierda; Recibir · Precio · Total a la derecha, en
                columnas fijas) y los títulos una sola vez arriba. Teléfono: las cajas debajo del nombre, con su título. */}
            {hasCols && (
              <li className={`hidden gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground sm:grid ${smCols}`}>
                <span />
                {receiving && <span>{ta("col_to_receive")}</span>}
                {canCosts && (
                  <>
                    <span>{ta("f_price")}</span>
                    <span className="text-right">{ta("f_total")}</span>
                  </>
                )}
              </li>
            )}
            {order.lines.map((l) => {
              const unit = unitPrice(l.id);
              const done = l.receivedQty >= l.qty;
              const pack = packOf(index, l.variantId);
              const per = pack?.qty ?? 1;
              const showReceive = receiving && !done;
              return (
                <li key={l.id} className={`grid items-start gap-3 border-b border-border px-3 py-3 text-sm last:border-0 ${smCols}`}>
                  <span className="flex min-w-0 items-start gap-3">
                    <PurchasePhoto variantId={l.variantId} index={index} photoPath={destByLine?.get(l.id)?.photoPath} />
                    <span className="min-w-0">
                      <span className="block break-words font-medium">{lineName(l)}</span>
                      {!l.variantId && !destByLine?.get(l.id)?.forProject && <span className="block text-xs text-muted-foreground">{ta("free_item")}</span>}
                      <LineDestinationTag dest={destByLine?.get(l.id)} variantId={l.variantId} />
                      <PurchaseQty
                        qty={l.qty}
                        receivedQty={l.receivedQty}
                        unit={l.unit}
                        pack={pack}
                        lang={lang}
                        className={`mt-0.5 block max-w-none text-left text-xs ${done ? "text-success" : "text-muted-foreground"}`}
                      />
                      {showReceive && destByLine?.get(l.id)?.forProject && (
                        <Input
                          className="mt-2 h-8 text-sm"
                          aria-label={ta("st_f_location")}
                          placeholder={ta("receive_location_ph")}
                          value={locations[l.id] ?? ""}
                          onChange={(e) => setLocations((m) => ({ ...m, [l.id]: e.target.value }))}
                        />
                      )}
                    </span>
                  </span>
                  {hasCols && (
                    <div className="grid grid-cols-2 items-start gap-3 sm:contents">
                      {receiving &&
                        (showReceive ? (
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs text-muted-foreground sm:hidden">{ta("col_to_receive")}</span>
                            <QtyInput aria-label={ta("col_to_receive")} value={receive[l.id] ?? ""} onChange={(v) => setReceive((r) => ({ ...r, [l.id]: v }))} />
                            {pack && <span className="text-xs text-muted-foreground">× {pack.label || formatQty(pack.qty, lang)}</span>}
                          </div>
                        ) : (
                          <span className="hidden sm:block" />
                        ))}
                      {canCosts && (
                        <>
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs text-muted-foreground sm:hidden">{ta("f_price")}</span>
                            {canPurchase ? (
                              <MoneyInput aria-label={ta("f_price")} value={prices[l.id] ?? ""} onValueChange={(v) => setPrices((p) => ({ ...p, [l.id]: v }))} />
                            ) : (
                              <span className="flex h-9 items-center justify-end tabular-nums">{unit != null ? formatUnitCost(unit * per) : "—"}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {pack ? ta("price_per_pack", { p: pack.label || formatQty(pack.qty, lang) }) : ta("price_each")}
                            </span>
                          </div>
                          {/* Total: en el teléfono, al lado del precio si no hay «Recibir»; si lo hay, en su propia fila. */}
                          <div
                            className={`flex min-w-0 gap-1.5 sm:col-span-1 sm:flex-col ${showReceive ? "col-span-2 items-center justify-between border-t border-border pt-2 sm:border-0 sm:pt-0" : "flex-col"}`}
                          >
                            <span className={`text-xs text-muted-foreground sm:hidden ${showReceive ? "" : "text-right"}`}>{ta("f_total")}</span>
                            <span className={`flex items-center justify-end font-medium tabular-nums sm:h-9 ${showReceive ? "" : "h-9"}`}>
                              {unit != null ? formatCents(Math.round(unit * l.qty)) : "—"}
                            </span>
                          </div>
                        </>
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
              <div className="flex items-end gap-2">
                <Field className="w-44" label={ta("date")} icon={ICON.date}>
                  <Input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
                </Field>
                <Button size="sm" className="h-9 flex-1 sm:flex-none" onClick={doReceive} disabled={busy}>
                  {ta("receive_save")}
                </Button>
              </div>
            </div>
          )}

          {canCosts && order.status !== "cancelado" && (
            <FormSection
              quiet
              icon={Receipt}
              title={ta("invoice")}
              action={<span className="text-sm font-semibold tabular-nums">{ta("order_total", { t: formatCents(totalCents) })}</span>}
            >
              <div className="flex items-end gap-2">
                <Field className="flex-1" label={ta("f_invoice_ref")}>
                  <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} disabled={!canPurchase} />
                </Field>
                {canPurchase && (
                  <Button size="sm" variant="outline" className="h-9" onClick={doInvoice} disabled={busy || !invoiceDirty}>
                    {ta("save_invoice")}
                  </Button>
                )}
              </div>
            </FormSection>
          )}
        </section>

        {canPurchase && order.status === "pedido" && nothingReceived && (
          <div className="flex justify-end border-t border-border pt-3">
            <ConfirmButton label={ta("cancel_order")} confirmLabel={ta("cancel_order_confirm")} onConfirm={() => void doCancel()} disabled={busy} />
          </div>
        )}
        {dialog}
      </DialogContent>
    </Dialog>
  );
}
