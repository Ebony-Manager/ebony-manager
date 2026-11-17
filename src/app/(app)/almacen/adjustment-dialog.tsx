"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Package, Plus, X } from "lucide-react";

import { ADJUSTMENT_REASONS, type AdjustmentReason, type InventoryCategory, type InventoryItem } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatQty, parseQty } from "@/lib/almacen/inventory";
import { Field } from "../contratistas/field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { registerAdjustmentAction } from "./actions";
import { Combo, QtyInput, qtyWithUnit, useTa, useVariantIndex, useVariantOptions } from "./shared";

interface LineDraft {
  key: string;
  variantId: string | null;
  qty: string;
}

let seq = 0;
const newLine = (variantId: string | null = null): LineDraft => ({ key: `a${++seq}`, variantId, qty: "" });

/**
 * Conteo y carga inicial: se escribe lo contado y la app calcula la
 * diferencia. Daño y pérdida: cuánto se descuenta. Corrección: la diferencia
 * con signo. "Agregar toda una categoría" sirve para contar estante por estante.
 */
export function AdjustmentDialog({
  open,
  onOpenChange,
  items,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  categories: InventoryCategory[];
}) {
  const { ta, lang } = useTa();
  const index = useVariantIndex(items);
  const catName = React.useCallback((id: string | null) => categories.find((c) => c.id === id)?.name ?? "", [categories]);
  const variantOptions = useVariantOptions(items, catName);

  const [reason, setReason] = React.useState<AdjustmentReason>("conteo");
  const [lines, setLines] = React.useState<LineDraft[]>([newLine()]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<string>();
  const dirty = () => lines.some((l) => l.variantId || l.qty.trim()) || !!notes.trim() || reason !== "conteo";
  const { requestClose, dialog: discardDialog } = useDiscardGuard(dirty, () => onOpenChange(false));

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setReason("conteo");
    setLines([newLine()]);
    setNotes("");
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const counted = reason === "conteo" || reason === "inicial";
  const subtract = reason === "dano" || reason === "perdida";
  const patch = (key: string, p: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  function addCategory(categoryId: string) {
    const have = new Set(lines.map((l) => l.variantId));
    const add = items
      .filter((i) => i.active && i.categoryId === categoryId)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .flatMap((i) => i.variants.filter((v) => v.active && !have.has(v.id)).map((v) => newLine(v.id)));
    setLines((ls) => [...ls.filter((l) => l.variantId), ...add]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = lines
      .map((l) => ({ variantId: l.variantId, qty: parseQty(l.qty) }))
      .filter((l): l is { variantId: string; qty: number } => !!l.variantId && l.qty != null)
      .map((l) => ({ ...l, qty: subtract ? -Math.abs(l.qty) : l.qty }));
    const first = lines[0];
    const noChanges = counted && parsed.length > 0 && parsed.every((l) => index.get(l.variantId)?.variant.stockQty === l.qty);
    const ok = validate([
      [`prod-${first.key}`, parsed.length === 0 && !first.variantId, ta("lines_required")],
      [`qty-${first.key}`, (parsed.length === 0 && !!first.variantId) || noChanges, noChanges ? ta("adj_no_changes") : ta("qty_required")],
    ]);
    if (!ok) return;
    setSaving(true);
    const res = await registerAdjustmentAction(reason, notes || null, counted, parsed);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("adj_saved"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("new_adjustment")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={ta("f_reason_adj")} hint={counted ? ta("adj_mode_count") : subtract ? ta("adj_mode_out") : ta("adj_mode_delta")}>
            <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ta(`r_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FormSection
            icon={Package}
            title={ta("col_items")}
            action={
              <Select value="" onValueChange={addCategory}>
                <SelectTrigger className="h-8 w-auto text-xs font-medium">
                  <SelectValue placeholder={ta("add_category")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            {lines.map((l) => {
              const ref = l.variantId ? index.get(l.variantId) : undefined;
              const n = parseQty(l.qty);
              const diff = ref && n != null ? (counted ? n - ref.variant.stockQty : subtract ? -Math.abs(n) : n) : null;
              return (
                <div key={l.key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="grid grid-cols-[1fr_28px] items-end gap-2">
                    <Field label={ta("f_product")} required error={error(`prod-${l.key}`)}>
                      <Combo
                        options={variantOptions}
                        value={l.variantId}
                        onChange={(v) => {
                          patch(l.key, { variantId: v });
                          clear(`prod-${l.key}`);
                        }}
                        placeholder={ta("pick_product")}
                      />
                    </Field>
                    <button
                      type="button"
                      title={ta("remove")}
                      aria-label={ta("remove")}
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))}
                      className="mb-1.5 flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <Field
                    className="w-36"
                    label={counted ? ta("counted") : ta("qty")}
                    required
                    error={error(`qty-${l.key}`)}
                    hint={
                      ref
                        ? `${ta("stock_now")}: ${qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}${
                            diff != null && diff !== 0 ? ` · ${ta("difference")}: ${diff > 0 ? "+" : ""}${formatQty(diff, lang)}` : ""
                          }`
                        : undefined
                    }
                  >
                    <QtyInput
                      value={l.qty}
                      onChange={(v) => {
                        patch(l.key, { qty: v });
                        clear(`qty-${l.key}`);
                      }}
                    />
                  </Field>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="size-3.5" />
              {ta("add_line")}
            </Button>
          </FormSection>

          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
