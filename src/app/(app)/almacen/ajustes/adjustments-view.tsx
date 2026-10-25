"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";

import { ADJUSTMENT_REASONS, type AdjustmentReason, type InventoryAdjustment, type InventoryCategory, type InventoryItem } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatQty, parseQty } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { registerAdjustmentAction } from "../actions";
import { Combo, EmptyBox, PageHeader, QtyInput, qtyWithUnit, useTa, useVariantIndex, useVariantOptions } from "../shared";

/** Historial de ajustes y el diálogo de conteo / ajuste. */
export function AdjustmentsView({
  adjustments,
  items,
  categories,
}: {
  adjustments: InventoryAdjustment[];
  items: InventoryItem[];
  categories: InventoryCategory[];
}) {
  const { ta, lang } = useTa();
  const [adding, setAdding] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  const index = useVariantIndex(items);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6">
      <PageHeader
        title={ta("adj_title")}
        subtitle={ta("adj_subtitle")}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {ta("new_adjustment")}
          </Button>
        }
      />

      {adjustments.length === 0 ? (
        <EmptyBox>{ta("adj_empty")}</EmptyBox>
      ) : (
        <div className="overflow-x-auto border border-ink-900/8 bg-card">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                <th className="w-8" />
                <th className="px-3 py-2 text-left font-medium">{ta("date")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("col_reason")}</th>
                <th className="px-3 py-2 text-right font-medium">{ta("col_changes")}</th>
                <th className="px-3.5 py-2 text-left font-medium">{ta("by")}</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => {
                const isOpen = open === a.id;
                return (
                  <React.Fragment key={a.id}>
                    <tr onClick={() => setOpen(isOpen ? null : a.id)} className="cursor-pointer border-b border-ink-900/8 hover:bg-muted/30">
                      <td className="pl-3 text-muted-foreground">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDateCompact(lang, a.adjustedOn)}</td>
                      <td className="px-3 py-2.5 font-medium">{ta(`r_${a.reason}`)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.lines.length}</td>
                      <td className="px-3.5 py-2.5 text-muted-foreground">{a.createdByName ?? "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-ink-900/8 bg-muted/20">
                        <td />
                        <td colSpan={4} className="px-3 py-2.5">
                          <ul className="flex flex-col gap-1">
                            {a.lines.map((l) => {
                              const ref = index.get(l.variantId);
                              return (
                                <li key={l.variantId} className="flex flex-wrap justify-between gap-x-4">
                                  <span>{ref?.name ?? "—"}</span>
                                  <span className="tabular-nums">
                                    <span className={l.qty < 0 ? "text-destructive" : "text-success"}>
                                      {l.qty > 0 ? "+" : ""}
                                      {formatQty(l.qty, lang)}
                                    </span>
                                    <span className="ml-2 text-muted-foreground">→ {qtyWithUnit(l.stockAfter, ref?.item.unit, lang)}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {a.notes && <p className="mt-2 text-xs text-muted-foreground">{a.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdjustmentDialog open={adding} onOpenChange={setAdding} items={items} categories={categories} />
    </div>
  );
}

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
function AdjustmentDialog({
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
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setReason("conteo");
    setLines([newLine()]);
    setNotes("");
    setError(null);
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
    if (parsed.length === 0) return setError(ta("lines_required"));
    if (counted && parsed.every((l) => index.get(l.variantId)?.variant.stockQty === l.qty)) return setError(ta("adj_no_changes"));
    setSaving(true);
    const res = await registerAdjustmentAction(reason, notes || null, counted, parsed);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("adj_saved"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{ta("col_items")}</h3>
              <Select value="" onValueChange={addCategory}>
                <SelectTrigger className="h-8 w-auto">
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
            </div>
            {lines.map((l) => {
              const ref = l.variantId ? index.get(l.variantId) : undefined;
              const n = parseQty(l.qty);
              const diff = ref && n != null ? (counted ? n - ref.variant.stockQty : subtract ? -Math.abs(n) : n) : null;
              return (
                <div key={l.key} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[1fr_96px_28px] items-center gap-2">
                    <Combo options={variantOptions} value={l.variantId} onChange={(v) => patch(l.key, { variantId: v })} placeholder={ta("pick_product")} />
                    <QtyInput
                      value={l.qty}
                      onChange={(v) => patch(l.key, { qty: v })}
                      placeholder={counted ? ta("counted") : ta("qty")}
                      aria-label={counted ? ta("counted") : ta("qty")}
                    />
                    <button
                      type="button"
                      title={ta("remove")}
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))}
                      className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {ref && (
                    <p className="text-xs text-muted-foreground">
                      {ta("stock_now")}: {qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}
                      {diff != null && diff !== 0 && (
                        <span className={diff < 0 ? "ml-2 text-destructive" : "ml-2 text-success"}>
                          {ta("difference")}: {diff > 0 ? "+" : ""}
                          {formatQty(diff, lang)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="size-3.5" />
              {ta("add_line")}
            </Button>
          </div>

          <Field label={ta("notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
