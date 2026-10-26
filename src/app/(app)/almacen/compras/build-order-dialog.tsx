"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { OrderDelivery, PurchaseRequest, Supplier } from "@/types/almacen";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "../../contratistas/field";
import { createPurchaseOrderAction } from "../actions";
import { Combo, qtyWithUnit, useTa, type VariantRef } from "../shared";
import { requestName } from "./common";

/** Elegir o cambiar el proveedor antes de pasar las solicitudes a En camino (crea el pedido; el WhatsApp sale desde el pedido). */
export function BuildOrderDialog({
  draft,
  requests,
  index,
  suppliers,
  onClose,
  onCreated,
}: {
  draft: { supplierId: string | null; requestIds: string[] } | null;
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  suppliers: Supplier[];
  onClose: () => void;
  onCreated: (orderId: string) => void;
}) {
  const { ta, lang } = useTa();
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [delivery, setDelivery] = React.useState<OrderDelivery>("retiro");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!draft) return;
    setSupplierId(draft.supplierId);
    setNotes("");
    setDelivery("retiro");
    setError(null);
  }, [draft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const picked = React.useMemo(() => requests.filter((r) => draft?.requestIds.includes(r.id)), [requests, draft]);
  const options = React.useMemo(() => suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.contactName ?? undefined })), [suppliers]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) return setError(ta("supplier_required"));
    setSaving(true);
    const res = await createPurchaseOrderAction(supplierId, picked.map((r) => r.id), notes || null, delivery);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("order_created"));
    onCreated(res.data);
  }

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("order_new_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={ta("f_supplier")}>
            <Combo options={options} value={supplierId} onChange={setSupplierId} placeholder={ta("pick_supplier")} />
          </Field>
          <Field label={ta("delivery_q")}>
            <SegmentedFilter
              fill
              value={delivery}
              onChange={setDelivery}
              options={[
                { value: "retiro", label: ta("delivery_retiro") },
                { value: "entrega", label: ta("delivery_entrega") },
              ]}
            />
          </Field>
          <ul className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
            {picked.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{requestName(r, index)}</span>
                <span className="shrink-0 tabular-nums">{qtyWithUnit(r.qty, r.unit, lang)}</span>
              </li>
            ))}
          </ul>
          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving || picked.length === 0}>
              {saving ? ta("saving") : ta("mark_ordered")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
