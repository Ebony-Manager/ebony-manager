"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Archive, Plus, X } from "lucide-react";

import { INVENTORY_UNITS, type InventoryCategory, type InventoryItem, type InventoryUnit, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { formatQty, parseQty, roundUpToPack, suggestedOrderQty, toPacks } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
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
  /** Especial para proyecto: link de Amazon, medidas… (va en el motivo de esa solicitud). */
  notes: string;
}

let seq = 0;
const newLine = (): Line => ({ key: `l${++seq}`, variantId: null, description: "", qty: "", unit: "unidad", supplierId: null, notes: "" });

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

  // special = "Especial para proyecto": texto libre con proyecto; al llegar va a Apartados.
  const [mode, setMode] = React.useState<"catalog" | "free" | "special">("catalog");
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<string>();
  const isSpecial = mode === "special";
  const dirty = () => lines.some((l) => l.variantId || l.description.trim() || l.qty.trim() || l.notes.trim()) || !!projectId || !!reason.trim();
  const { requestClose, dialog: discardDialog } = useDiscardGuard(dirty, () => onOpenChange(false));

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMode(items.some((i) => i.active) ? "catalog" : "free");
    setLines([newLine()]);
    setProjectId(null);
    setReason("");
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open, items]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const lineVariant = (l: Line) => (mode === "catalog" && l.variantId ? index.get(l.variantId) : undefined);
  const linePack = (l: Line) => (mode === "catalog" ? packOf(index, l.variantId) : null);

  function pickVariant(key: string, id: string) {
    const r = index.get(id);
    // El proveedor principal del producto, si tiene; la cantidad sugerida, en presentaciones si se compra así.
    const primary = r?.item.suppliers.find((s) => s.isPrimary) ?? r?.item.suppliers[0];
    const supplierId = primary?.supplierId ?? null;
    const pack = packOf(index, id);
    const suggested = r ? suggestedOrderQty(r.variant, r.item.allowsDecimals) : 0;
    patch(key, { variantId: id, supplierId, qty: r ? String(pack ? toPacks(roundUpToPack(suggested, pack), pack) : suggested) : "" });
  }

  function changeMode(m: "catalog" | "free" | "special") {
    setMode(m);
    setLines([newLine()]);
    reset();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Los renglones en blanco (el último que se agregó y no se llenó) se ignoran.
    const filled = lines.filter((l) => (mode === "catalog" ? l.variantId : l.description.trim()) || l.qty.trim());
    const parsed = filled.map((l) => ({ line: l, n: parseQty(l.qty) }));
    // Sin ningún renglón lleno, se marca el primero (qué y cuánto).
    const checked = parsed.length ? parsed : [{ line: lines[0], n: null as number | null }];
    const ok = validate([
      ...checked.flatMap(({ line: l, n }) => [
        [`what-${l.key}`, mode === "catalog" ? !l.variantId : !l.description.trim(), ta("what_required")] as const,
        [`qty-${l.key}`, n == null || n <= 0, ta("qty_required")] as const,
      ]),
      ["project", isSpecial && !projectId, ta("st_project_required")] as const,
    ]);
    if (!ok) return;

    setSaving(true);
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
          reason: isSpecial ? l.notes : reason,
          supplierId: l.supplierId,
          forProject: isSpecial,
          itemId: ref?.item.id ?? null,
        },
        // Con Compras, el proveedor elegido queda como principal del producto que no tenía.
        canPurchase && !!ref && ref.item.suppliers.length === 0,
      );
      if (!res.ok) {
        setSaving(false);
        // Las que ya se guardaron se quitan para no duplicarlas al reintentar.
        setLines((ls) => ls.filter((x) => !parsed.slice(0, done).some((p) => p.line.key === x.key)));
        return void toast.error(res.error);
      }
      done += 1;
    }
    setSaving(false);
    toast.success(done === 1 ? ta("request_saved") : ta("requests_saved", { n: done }));
    onOpenChange(false);
  }

  const count = lines.filter((l) => (mode === "catalog" ? l.variantId : l.description.trim())).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("new_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <SegmentedFilter
            value={mode}
            onChange={changeMode}
            options={[
              { value: "catalog", label: ta("request_from_catalog"), icon: ICON.catalog },
              { value: "free", label: ta("request_free"), icon: ICON.freeText },
              { value: "special", label: ta("request_special"), icon: Archive },
            ]}
          />
          {isSpecial && <p className="-mt-2 text-xs text-muted-foreground">{ta("request_special_hint")}</p>}

          <ul className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const ref = lineVariant(l);
              const pack = linePack(l);
              const n = parseQty(l.qty);
              return (
                <li key={l.key} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <Field
                      className="min-w-0 flex-1"
                      label={mode === "catalog" ? ta("f_product") : ta("f_what")}
                      required
                      error={error(`what-${l.key}`)}
                      hint={ref ? `${ta("stock_now")}: ${qtyWithUnit(ref.variant.stockQty, ref.item.unit, lang)}` : undefined}
                    >
                      {mode === "catalog" ? (
                        <Combo
                          options={variantOptions}
                          value={l.variantId}
                          onChange={(id) => {
                            pickVariant(l.key, id);
                            clear(`what-${l.key}`);
                            clear(`qty-${l.key}`);
                          }}
                          placeholder={ta("pick_product")}
                        />
                      ) : (
                        <Input
                          value={l.description}
                          onChange={(e) => {
                            patch(l.key, { description: e.target.value });
                            clear(`what-${l.key}`);
                          }}
                          placeholder={ta("f_what_ph")}
                          autoFocus={i === lines.length - 1 && i > 0}
                        />
                      )}
                    </Field>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="mt-[22px] flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label={ta("remove")}
                        title={ta("remove")}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 min-[480px]:grid-cols-[8rem_1fr]">
                    <Field
                      label={ta("qty")}
                      required
                      error={error(`qty-${l.key}`)}
                      hint={
                        mode === "catalog" && pack
                          ? `× ${pack.label || formatQty(pack.qty, lang)}${n && n > 0 ? ` = ${qtyWithUnit(n * pack.qty, ref?.item.unit, lang)}` : ""}`
                          : mode === "catalog" && ref
                            ? ta(`unit_${ref.item.unit}`)
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
                    {mode !== "catalog" && (
                      <Field label={ta("f_unit")}>
                        <Select value={l.unit} onValueChange={(v) => patch(l.key, { unit: v as InventoryUnit })}>
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
                      </Field>
                    )}
                  </div>

                  {isSpecial && (
                    <Field label={ta("f_special_notes")}>
                      <Textarea rows={2} value={l.notes} onChange={(e) => patch(l.key, { notes: e.target.value })} placeholder={ta("f_special_notes_ph")} />
                    </Field>
                  )}

                  {supplierOptions.length > 0 && (
                    <Field label={ta("f_supplier")}>
                      <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
                        <Combo options={supplierOptions} value={l.supplierId} onChange={(id) => patch(l.key, { supplierId: id })} placeholder={ta("pick_supplier")} />
                        {l.supplierId && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => patch(l.key, { supplierId: null })}>
                            {ta("remove")}
                          </Button>
                        )}
                      </div>
                    </Field>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
            <Plus className="size-3.5" />
            {ta("add_another_item")}
          </Button>

          {projectOptions.length > 0 && (
            <Field label={ta("dest_project")} required={isSpecial} error={error("project")}>
              <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
                <Combo
                  options={projectOptions}
                  value={projectId}
                  onChange={(id) => {
                    setProjectId(id);
                    clear("project");
                  }}
                  placeholder={ta("pick_project")}
                />
                {projectId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                    {ta("remove")}
                  </Button>
                )}
              </div>
            </Field>
          )}

          {!isSpecial && (
            <Field label={ta("f_reason")}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ta("f_reason_ph")} />
            </Field>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : count > 1 ? ta("new_requests_n", { n: count }) : ta("new_request")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
