"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Copy, MapPin, Truck, type LucideIcon } from "lucide-react";

import type { OrderDelivery, Supplier } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { mapsUrl, orderMessage, whatsappUrl, type OrderMessageLine } from "@/lib/almacen/inventory";
import { useTa } from "../shared";

export const DELIVERY_ICON: Record<OrderDelivery, LucideIcon> = { entrega: Truck, retiro: MapPin };

/** "Lo traen" / "Por retirar" (retiro en ámbar: es trabajo para el mensajero). */
export function DeliveryBadge({ delivery }: { delivery: OrderDelivery | null }) {
  const { ta } = useTa();
  if (!delivery) return null;
  const Icon = DELIVERY_ICON[delivery];
  return (
    <Badge variant={delivery === "retiro" ? "warning" : "secondary"} className="gap-1">
      <Icon className="size-3" />
      {ta(delivery === "retiro" ? "delivery_retiro" : "delivery_entrega")}
    </Badge>
  );
}

/** «Abrir en Maps» con la ubicación del proveedor (Directorio); nada si no la tiene. */
export function MapsButton({ supplier, className }: { supplier: Supplier | null | undefined; className?: string }) {
  const { ta } = useTa();
  const url = mapsUrl(supplier?.address);
  if (!url) return null;
  return (
    <Button asChild size="sm" variant="outline" className={className}>
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <MapPin className="size-4" />
        {ta("open_maps")}
      </a>
    </Button>
  );
}

/** El mensaje del pedido para el proveedor: editable, por WhatsApp o copiado. */
export function OrderMessageBox({ supplier, lines, notes }: { supplier: Supplier | null; lines: OrderMessageLine[]; notes?: string | null }) {
  const { ta } = useTa();
  const [message, setMessage] = React.useState(() => orderMessage(supplier?.contactName ?? null, lines, notes));
  const wa = whatsappUrl(supplier?.whatsapp, message);
  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} className="text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        {wa ? (
          <Button asChild size="sm">
            <a href={wa} target="_blank" rel="noreferrer">
              <WhatsAppIcon className="size-4" />
              {ta("send_whatsapp")}
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{ta("no_whatsapp")}</p>
        )}
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success(ta("copied")))}>
          <Copy className="size-4" />
          {ta("copy_message")}
        </Button>
      </div>
    </div>
  );
}

/** Paso 1 en Por pedir: mandarle el pedido al proveedor, antes de marcarlo «Pedido ✓». */
export function OrderMessageDialog({
  draft,
  onClose,
}: {
  draft: { supplier: Supplier | null; lines: OrderMessageLine[] } | null;
  onClose: () => void;
}) {
  const { ta } = useTa();
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ta("order_message")}
            {draft?.supplier ? ` · ${draft.supplier.name}` : ""}
          </DialogTitle>
          <DialogDescription>{ta("order_message_hint")}</DialogDescription>
        </DialogHeader>
        {draft && <OrderMessageBox key={draft.lines.map((l) => l.name).join("|")} supplier={draft.supplier} lines={draft.lines} />}
      </DialogContent>
    </Dialog>
  );
}

/** «Pedido ✓» con la pregunta de cómo llega: lo traen o por retirar. */
export function MarkOrderedButton({ count, disabled, onPick }: { count: number; disabled?: boolean; onPick: (delivery: OrderDelivery) => void }) {
  const { ta } = useTa();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={disabled}>
          {ta("mark_ordered")} ({count})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{ta("delivery_q")}</p>
        {(["retiro", "entrega"] as const).map((d) => {
          const Icon = DELIVERY_ICON[d];
          return (
            <DropdownMenuItem key={d} onSelect={() => onPick(d)} className="items-start">
              <Icon className="mt-0.5 size-4" />
              <span>
                <span className="block font-medium">{ta(d === "retiro" ? "delivery_retiro" : "delivery_entrega")}</span>
                <span className="block text-xs text-muted-foreground">{ta(d === "retiro" ? "delivery_retiro_hint" : "delivery_entrega_hint")}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
