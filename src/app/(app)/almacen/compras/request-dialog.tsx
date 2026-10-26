"use client";

import * as React from "react";
import toast from "react-hot-toast";

import { INVENTORY_UNITS, type InventoryCategory, type InventoryItem, type InventoryUnit, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { parseQty, suggestedOrderQty } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { createPurchaseRequestAction } from "../actions";
import { Combo, QtyInput, qtyWithUnit, useTa, useVariantIndex, useVariantOptions } from "../shared";

type Project = { id: string; name: string; active: boolean };
/**
 * Pedir algo: del catálogo (con la cantidad sugerida) o en texto libre
 * ("escobas"). Quien ve el Almacén puede elegir el proveedor (por defecto, el
 * principal del producto); con Compras, si el producto no tenía, queda como
 * su principal.
 */
export function RequestDialog({
  open,
  onOpenChange,
  items,
  categories,
  projects,
  suppliers,
  canPurchase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  categories: InventoryCategory[];
  projects: Project[];
  /** Vacío = no elige proveedor (no ve el Almacén). */
  suppliers: Supplier[];
  canPurchase: boolean;
}) {
  const { ta, lang } = useTa();
  const index = useVariantIndex(items);
  const catName = React.useCallback((id: string | null) => categories.find((c) => c.id === id)?.name ?? "", [categories]);
  const variantOptions = useVariantOptions(items, catName);
  const supplierOptions = React.useMemo(() => suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.contactName ?? undefined })), [suppliers]);
  const projectOptions = React.useMemo(() => projects.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name })), [projects]);

  const [mode, setMode] = React.useState<"catalog" | "free">("catalog");
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState<InventoryUnit>("unidad");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [remember, setRemember] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMode(items.some((i) => i.active) ? "catalog" : "free");
    setVariantId(null);
    setDescription("");
    setQty("");
    setUnit("unidad");
    setProjectId(null);
    setReason("");
    setSupplierId(null);
    setRemember(true);
    setError(null);
  }, [open, items]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const ref = variantId ? index.get(variantId) : undefined;

  function pickVariant(id: string) {
    setVariantId(id);
    const r = index.get(id);
    if (r) setQty(String(suggestedOrderQty(r.variant, r.item.allowsDecimals)));
    // El proveedor principal del producto, si tiene.
    const primary = r?.item.suppliers.find((s) => s.isPrimary) ?? r?.item.suppliers[0];
    setSupplierId(primary?.supplierId ?? null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "catalog" ? !variantId : !description.trim()) return setError(ta("what_required"));
    const n = parseQty(qty);
    if (n == null || n <= 0) return setError(ta("qty_required"));
    setSaving(true);
    const res = await createPurchaseRequestAction({
      variantId: mode === "catalog" ? variantId : null,
      description: mode === "catalog" ? "" : description,
      qty: n,
      unit: mode === "catalog" ? (ref?.item.unit ?? null) : unit,
      projectId,
      reason,
      supplierId,
      itemId: mode === "catalog" ? (ref?.item.id ?? null) : null,
    }, remember && !!ref && ref.item.suppliers.length === 0);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("request_saved"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("new_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <SegmentedFilter
            value={mode}
            onChange={setMode}
            options={[
              { value: "catalog", label: ta("request_from_catalog") },
              { value: "free", label: ta("request_free") },
            ]}
          />

          {mode === "catalog" ? (
            <Field
              label={ta("product")}
              hint={ref ? `${ta("stock_now")}: ${qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}` : undefined}
            >
              <Combo options={variantOptions} value={variantId} onChange={pickVariant} placeholder={ta("pick_product")} />
            </Field>
          ) : (
            <Field label={ta("f_what")}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={ta("f_what_ph")} autoFocus />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label={ta("qty")}>
              <QtyInput value={qty} onChange={setQty} />
            </Field>
            <Field label={ta("f_unit")}>
              {mode === "catalog" ? (
                <Input value={ref ? ta(`unit_${ref.item.unit}`) : ""} disabled />
              ) : (
                <Select value={unit} onValueChange={(v) => setUnit(v as InventoryUnit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {ta(`unit_${u}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          {supplierOptions.length > 0 && (
            <Field label={ta("f_supplier_opt")} hint={supplierId ? undefined : ta("supplier_default_hint")}>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combo options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder={ta("pick_supplier")} />
                {supplierId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSupplierId(null)}>
                    {ta("remove")}
                  </Button>
                )}
              </div>
              {canPurchase && supplierId && ref && ref.item.suppliers.length === 0 && (
                <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" className="size-3.5 accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {ta("remember_supplier_one")}
                </label>
              )}
            </Field>
          )}

          {projectOptions.length > 0 && (
            <Field label={ta("dest_project")}>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combo options={projectOptions} value={projectId} onChange={setProjectId} placeholder={ta("optional")} />
                {projectId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                    {ta("remove")}
                  </Button>
                )}
              </div>
            </Field>
          )}

          <Field label={ta("f_reason")}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ta("f_reason_ph")} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("new_request")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
