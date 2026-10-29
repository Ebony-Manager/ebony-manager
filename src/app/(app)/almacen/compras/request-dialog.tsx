"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";

import { INVENTORY_UNITS, type InventoryCategory, type InventoryItem, type InventoryUnit, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatQty, parseQty, roundUpToPack, suggestedOrderQty, toPacks } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { createPurchaseRequestAction } from "../actions";
import { Combo, QtyInput, qtyWithUnit, useTa, useVariantIndex, useVariantOptions } from "../shared";
import { packOf } from "./common";

type Project = { id: string; name: string; active: boolean };

/** Un renglón de la solicitud: un producto del catálogo o algo en texto libre. */
interface Line {
  key: string;
  variantId: string | null;
  description: string;
  /** Con presentación (rollo, galón) es en presentaciones; si no, en la unidad del almacén. */
  qty: string;
  unit: InventoryUnit;
  supplierId: string | null;
}

let seq = 0;
const newLine = (): Line => ({ key: `l${++seq}`, variantId: null, description: "", qty: "", unit: "unidad", supplierId: null });

/**
 * Pedir uno o varios productos de una vez: del catálogo (con la cantidad
 * sugerida, redondeada a la presentación en que se compra: 2 rollos, no 30
 * pedazos) o en texto libre ("escobas"). El proyecto y el motivo valen para
 * todos. Quien ve el Almacén puede elegir el proveedor de cada uno (por
 * defecto, el principal del producto); con Compras, si el producto no tenía,
 * queda como su principal.
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
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMode(items.some((i) => i.active) ? "catalog" : "free");
    setLines([newLine()]);
    setProjectId(null);
    setReason("");
    setError(null);
  }, [open, items]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const lineVariant = (l: Line) => (mode === "catalog" && l.variantId ? index.get(l.variantId) : undefined);
  const linePack = (l: Line) => (mode === "catalog" ? packOf(index, l.variantId, l.supplierId) : null);

  function pickVariant(key: string, id: string) {
    const r = index.get(id);
    // El proveedor principal del producto, si tiene; la cantidad sugerida, en presentaciones si se compra así.
    const primary = r?.item.suppliers.find((s) => s.isPrimary) ?? r?.item.suppliers[0];
    const supplierId = primary?.supplierId ?? null;
    const pack = packOf(index, id, supplierId);
    const suggested = r ? suggestedOrderQty(r.variant, r.item.allowsDecimals) : 0;
    patch(key, { variantId: id, supplierId, qty: r ? String(pack ? toPacks(roundUpToPack(suggested, pack), pack) : suggested) : "" });
  }

  function changeMode(m: "catalog" | "free") {
    setMode(m);
    setLines([newLine()]);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Los renglones en blanco (el último que se agregó y no se llenó) se ignoran.
    const filled = lines.filter((l) => (mode === "catalog" ? l.variantId : l.description.trim()) || l.qty.trim());
    if (filled.length === 0 || filled.some((l) => (mode === "catalog" ? !l.variantId : !l.description.trim()))) return setError(ta("what_required"));
    const parsed = filled.map((l) => ({ line: l, n: parseQty(l.qty) }));
    if (parsed.some((p) => p.n == null || p.n <= 0)) return setError(ta("qty_required"));

    setSaving(true);
    setError(null);
    let done = 0;
    for (const { line: l, n } of parsed) {
      const ref = lineVariant(l);
      const pack = linePack(l);
      const res = await createPurchaseRequestAction(
        {
          variantId: mode === "catalog" ? l.variantId : null,
          description: mode === "catalog" ? "" : l.description,
          qty: pack ? Math.round(n! * pack.qty * 100) / 100 : n!,
          unit: mode === "catalog" ? (ref?.item.unit ?? null) : l.unit,
          projectId,
          reason,
          supplierId: l.supplierId,
          itemId: ref?.item.id ?? null,
        },
        // Con Compras, el proveedor elegido queda como principal del producto que no tenía.
        canPurchase && !!ref && ref.item.suppliers.length === 0,
      );
      if (!res.ok) {
        setSaving(false);
        // Las que ya se guardaron se quitan para no duplicarlas al reintentar.
        setLines((ls) => ls.filter((x) => !parsed.slice(0, done).some((p) => p.line.key === x.key)));
        return setError(res.error);
      }
      done += 1;
    }
    setSaving(false);
    toast.success(done === 1 ? ta("request_saved") : ta("requests_saved", { n: done }));
    onOpenChange(false);
  }

  const count = lines.filter((l) => (mode === "catalog" ? l.variantId : l.description.trim())).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("new_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <SegmentedFilter
            value={mode}
            onChange={changeMode}
            options={[
              { value: "catalog", label: ta("request_from_catalog") },
              { value: "free", label: ta("request_free") },
            ]}
          />

          <ul className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const ref = lineVariant(l);
              const pack = linePack(l);
              const n = parseQty(l.qty);
              return (
                <li key={l.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {mode === "catalog" ? (
                        <Combo options={variantOptions} value={l.variantId} onChange={(id) => pickVariant(l.key, id)} placeholder={ta("pick_product")} />
                      ) : (
                        <Input
                          value={l.description}
                          onChange={(e) => patch(l.key, { description: e.target.value })}
                          placeholder={ta("f_what_ph")}
                          aria-label={ta("f_what")}
                          autoFocus={i === lines.length - 1 && i > 0}
                        />
                      )}
                      {ref && (
                        <p className="mt-1 px-1 text-xs text-muted-foreground">
                          {ta("stock_now")}: {qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}
                        </p>
                      )}
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label={ta("remove")}
                        title={ta("remove")}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-24">
                      <QtyInput value={l.qty} onChange={(v) => patch(l.key, { qty: v })} aria-label={ta("qty")} placeholder={ta("qty")} />
                    </div>
                    {mode === "catalog" ? (
                      <span className="text-sm text-muted-foreground">
                        {pack
                          ? `× ${pack.label || formatQty(pack.qty, lang)}${n && n > 0 ? ` = ${qtyWithUnit(n * pack.qty, ref?.item.unit, lang)}` : ""}`
                          : ref
                            ? ta(`unit_${ref.item.unit}`)
                            : ""}
                      </span>
                    ) : (
                      <Select value={l.unit} onValueChange={(v) => patch(l.key, { unit: v as InventoryUnit })}>
                        <SelectTrigger className="w-36" aria-label={ta("f_unit")}>
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
                    {supplierOptions.length > 0 && (
                      <div className="flex min-w-48 flex-1 items-center gap-1">
                        <Combo
                          options={supplierOptions}
                          value={l.supplierId}
                          onChange={(id) => patch(l.key, { supplierId: id })}
                          placeholder={ta("f_supplier_opt")}
                          className="h-9"
                        />
                        {l.supplierId && (
                          <button
                            type="button"
                            onClick={() => patch(l.key, { supplierId: null })}
                            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label={ta("remove")}
                            title={ta("remove")}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
            <Plus className="size-3.5" />
            {ta("add_another_item")}
          </Button>

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
              {saving ? ta("saving") : count > 1 ? ta("new_requests_n", { n: count }) : ta("new_request")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
