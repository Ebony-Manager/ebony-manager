"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { PurchaseRequest, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "../../contratistas/field";
import { setRequestsSupplierAction } from "../actions";
import { Combo, qtyWithUnit, useTa, type VariantRef } from "../shared";
import { requestName } from "./common";

/**
 * Elegir (o cambiar) el proveedor de solicitudes en Por pedir: pasan al grupo
 * de ese proveedor, donde se les pone precio, se manda el WhatsApp y se marca
 * «Pedido ✓». Los productos sin proveedor pueden quedar con este como principal.
 */
export function SupplierPickDialog({
  draft,
  requests,
  index,
  suppliers,
  onClose,
}: {
  draft: { supplierId: string | null; requestIds: string[] } | null;
  requests: PurchaseRequest[];
  index: Map<string, VariantRef>;
  suppliers: Supplier[];
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [remember, setRemember] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!draft) return;
    setSupplierId(draft.supplierId);
    setRemember(true);
  }, [draft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const picked = React.useMemo(() => requests.filter((r) => draft?.requestIds.includes(r.id)), [requests, draft]);
  const options = React.useMemo(() => suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.contactName ?? undefined })), [suppliers]);
  // Productos del catálogo que todavía no tienen proveedor.
  const unlinked = React.useMemo(() => {
    const ids = new Set<string>();
    for (const r of picked) {
      const item = r.variantId ? index.get(r.variantId)?.item : undefined;
      if (item && item.suppliers.length === 0) ids.add(item.id);
    }
    return [...ids];
  }, [picked, index]);

  async function save() {
    if (!supplierId) return toast.error(ta("supplier_required"));
    setSaving(true);
    const res = await setRequestsSupplierAction(
      picked.map((r) => r.id),
      supplierId,
      remember ? unlinked : [],
    );
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("choose_supplier")}</DialogTitle>
          <DialogDescription>{ta("choose_supplier_hint")}</DialogDescription>
        </DialogHeader>
        <Field label={ta("f_supplier")}>
          <Combo options={options} value={supplierId} onChange={setSupplierId} placeholder={ta("pick_supplier")} />
        </Field>
        {supplierId && unlinked.length > 0 && (
          <label className="-mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="size-3.5 accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {ta("remember_supplier", { n: unlinked.length })}
          </label>
        )}
        <ul className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
          {picked.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{requestName(r, index)}</span>
              <span className="shrink-0 tabular-nums">{qtyWithUnit(r.qty, r.unit, lang)}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {ta("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !supplierId}>
            {saving ? ta("saving") : ta("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
