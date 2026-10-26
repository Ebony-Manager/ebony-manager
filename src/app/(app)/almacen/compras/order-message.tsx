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
  // A quién: los contactos con WhatsApp (el principal primero); sin ninguno, el WhatsApp viejo del proveedor.
  const people = (supplier?.contacts ?? []).filter((c) => whatsappUrl(c.whatsapp, ""));
  const [who, setWho] = React.useState(0);
  const person = people[who] ?? null;
  const [message, setMessage] = React.useState(() => orderMessage(person?.name || supplier?.contactName || null, lines, notes));
  const wa = whatsappUrl(person?.whatsapp ?? supplier?.whatsapp, message);

  function pick(i: number) {
    setWho(i);
    // Cambia el saludo al nombre de esa persona.
    setMessage(orderMessage(people[i]?.name || null, lines, notes));
  }

  return (
    <div className="flex flex-col gap-2">
      {people.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{ta("pick_contact")}</span>
          <div className="flex flex-wrap gap-1.5">
            {people.map((c, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === who}
                onClick={() => pick(i)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  i === who ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.name || c.whatsapp}
                {c.role ? ` · ${c.role}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
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
