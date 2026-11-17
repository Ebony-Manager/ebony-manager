"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, ImagePlus, Layers, Loader2, Plus, RotateCcw, Trash2, Truck, X } from "lucide-react";

import { INVENTORY_UNITS, type InventoryCategory, type InventoryItem, type InventoryUnit, type ItemKind, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatQty, parseQty, unitLabel } from "@/lib/almacen/inventory";
import { formatCents } from "@/lib/planilla/payroll-period";
import { INVENTORY_PHOTOS_BUCKET, inventoryPhotoPath } from "@/lib/almacen/photos";
import { createClient } from "@/lib/supabase/client";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { Field } from "../contratistas/field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { createItemAction, deleteItemAction, setItemPhotoAction, updateItemAction } from "./actions";
import { Combo, ItemThumb, QtyInput, qtyWithUnit, useTa } from "./shared";

interface VariantDraft {
  key: string;
  id?: string;
  label: string;
  min: string;
  reorder: string;
  active: boolean;
  stockQty: number;
  unitCostCents: number | null;
  price: string;
  /** Presentación de compra de la variante ("Galón" = 10). */
  packLabel: string;
  packQty: string;
  packOpen: boolean;
}

interface SupplierDraft {
  key: string;
  supplierId: string | null;
  isPrimary: boolean;
}

const NONE = "none";
/** Columnas de la fila de variante: nombre, mínimo, pedir hasta, quitar. */
let seq = 0;
const newKey = () => `k${++seq}`;
const newVariant = (): VariantDraft => ({
  key: newKey(), label: "", min: "", reorder: "", active: true, stockQty: 0, unitCostCents: null, price: "", packLabel: "", packQty: "", packOpen: false,
});
const priceText = (cents: number | null) => (cents == null ? "" : String(Number((cents / 100).toFixed(2))));
const priceCents = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : NaN;
};

/**
 * Ficha del producto. Con Compras se edita (datos, variantes con su mínimo y
 * "pedir hasta", y proveedores); sin Compras es solo lectura. Quitar una
 * variante la borra; si ya tiene historial, la base no deja y queda
 * desactivada (se puede reactivar).
 */
export function ItemDialog({
  item,
  categories,
  suppliers,
  canEdit,
  canCosts,
  onClose,
}: {
  item: InventoryItem | "new" | null;
  categories: InventoryCategory[];
  suppliers: Supplier[];
  canEdit: boolean;
  canCosts: boolean;
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const current = item && item !== "new" ? item : null;
  const readOnly = !canEdit;

  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>(NONE);
  const [unit, setUnit] = React.useState<InventoryUnit>("unidad");
  const [allowsDecimals, setAllowsDecimals] = React.useState(false);
  const [kind, setKind] = React.useState<ItemKind>("suministro");
  const [notes, setNotes] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [variants, setVariants] = React.useState<VariantDraft[]>([]);
  const [links, setLinks] = React.useState<SupplierDraft[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<string>();
  // Foto: en un producto existente se sube al elegirla; en uno nuevo, al guardarlo.
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = React.useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [armPhotoRemove, setArmPhotoRemove] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const snapshot = () =>
    JSON.stringify({ name, categoryId, unit, allowsDecimals, kind, notes, active, variants: variants.map((v) => ({ ...v, key: 0 })), links: links.map((l) => ({ ...l, key: 0 })), photo: !!pendingPhoto });
  /** Cómo estaba el formulario al abrir, para avisar si se cierra con cambios sin guardar. */
  const { isDirty, markSeeded } = useFormBaseline(snapshot);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!item) return;
    setPhotoPath(current?.photoPath ?? null);
    setConfirmDelete(false);
    setPendingPhoto(null);
    setName(current?.name ?? "");
    setCategoryId(current?.categoryId ?? NONE);
    setUnit(current?.unit ?? "unidad");
    setAllowsDecimals(current?.allowsDecimals ?? false);
    setKind(current?.kind ?? "suministro");
    setNotes(current?.notes ?? "");
    setActive(current?.active ?? true);
    setVariants(
      current?.variants.length
        ? current.variants.map((v) => ({
            key: newKey(),
            id: v.id,
            label: v.label,
            min: v.minQty != null ? String(v.minQty) : "",
            reorder: v.reorderQty != null ? String(v.reorderQty) : "",
            active: v.active,
            stockQty: v.stockQty,
            unitCostCents: v.unitCostCents,
            price: priceText(v.unitCostCents),
            packLabel: v.packLabel ?? "",
            packQty: v.packQty != null ? String(v.packQty) : "",
            packOpen: v.packQty != null && v.packQty > 1,
          }))
        : [newVariant()],
    );
    setLinks(
      (current?.suppliers ?? []).map((s) => ({
        key: newKey(),
        supplierId: s.supplierId,
        isPrimary: s.isPrimary,
      })),
    );
    reset();
    markSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [item, current]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => !readOnly && isDirty(), onClose);

  const supplierOptions = React.useMemo(
    () => suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.contactName ?? undefined })),
    [suppliers],
  );

  const activeVariants = variants.filter((v) => v.active);
  const inactiveVariants = variants.filter((v) => !v.active);
  const patchVariant = (key: string, patch: Partial<VariantDraft>) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const patchLink = (key: string, patch: Partial<SupplierDraft>) =>
    setLinks((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : patch.isPrimary ? { ...l, isPrimary: false } : l)));

  async function uploadPhoto(itemId: string, blob: Blob, oldPath: string | null): Promise<string> {
    const supabase = createClient();
    const path = inventoryPhotoPath(itemId);
    const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const res = await setItemPhotoAction(itemId, path);
    if (!res.ok) throw new Error(res.error);
    if (oldPath) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([oldPath]);
    return path;
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const blob = await resizeToJpeg(file, 800);
      if (current) {
        setPhotoPath(await uploadPhoto(current.id, blob, photoPath));
        toast.success(ta("photo_saved"));
      } else {
        setPendingPhoto({ blob, preview: URL.createObjectURL(blob) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("photo_error"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!current) return setPendingPhoto(null);
    setPhotoBusy(true);
    const res = await setItemPhotoAction(current.id, null);
    if (res.ok && photoPath) await createClient().storage.from(INVENTORY_PHOTOS_BUCKET).remove([photoPath]);
    setPhotoBusy(false);
    if (!res.ok) return toast.error(res.error);
    setPhotoPath(null);
  }

  async function deleteItem() {
    if (!current) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    const res = await deleteItemAction(current.id);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("item_deleted"));
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !validate([
        ["name", !name.trim(), ta("name_required")],
        ...activeVariants.map((v) => [`price-${v.key}`, Number.isNaN(priceCents(v.price)), ta("price_invalid")] as const),
      ])
    )
      return;
    const input = {
      name,
      categoryId: categoryId === NONE ? null : categoryId,
      unit,
      allowsDecimals,
      kind,
      notes,
      active,
      variants: variants.map((v) => ({
        id: v.id,
        label: v.label,
        minQty: parseQty(v.min),
        reorderQty: parseQty(v.reorder),
        active: v.active,
        unitCostCents: priceCents(v.price),
        packLabel: v.packLabel,
        packQty: parseQty(v.packQty),
      })),
      suppliers: links
        .filter((l) => l.supplierId)
        .map((l) => ({ supplierId: l.supplierId!, isPrimary: l.isPrimary })),
    };
    setSaving(true);
    const res = current ? await updateItemAction(current.id, input) : await createItemAction(input);
    if (res.ok && !current && pendingPhoto && typeof res.data === "string") {
      await uploadPhoto(res.data, pendingPhoto.blob, null).catch(() => toast.error(ta("photo_error")));
    }
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("saved"));
    if (typeof res.data === "number" && res.data > 0) toast(ta("variants_deactivated_toast", { n: res.data }));
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? ta("item_view_title") : current ? ta("item_edit_title") : ta("item_new_title")}</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex items-start gap-4">
            {/* La foto misma es el botón: sin foto abre la cámara/galería; con foto, un menú para cambiarla o quitarla. */}
            <div className="shrink-0">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
              {readOnly ? (
                <ItemThumb path={photoPath} size={88} />
              ) : !(photoPath || pendingPhoto) ? (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                  className="flex size-[88px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-[11px] font-medium text-muted-foreground hover:bg-muted/60"
                >
                  {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  {ta("photo_add")}
                </button>
              ) : (
                <DropdownMenu onOpenChange={(o) => !o && setArmPhotoRemove(false)}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" disabled={photoBusy} title={ta("photo_tap_hint")} aria-label={ta("photo_change")} className="relative block rounded-md">
                      {pendingPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element -- vista previa local antes de subir.
                        <img src={pendingPhoto.preview} alt="" className="size-[88px] rounded-md border border-border bg-white object-contain" />
                      ) : (
                        <ItemThumb path={photoPath} size={88} />
                      )}
                      <span className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                        {photoBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                      <Camera className="size-3.5" />
                      {ta("photo_change")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      className={armPhotoRemove ? "font-semibold" : undefined}
                      onSelect={(e) => {
                        if (!armPhotoRemove) {
                          e.preventDefault();
                          setArmPhotoRemove(true);
                          return;
                        }
                        void removePhoto();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {armPhotoRemove ? ta("remove_photo_confirm") : ta("photo_remove")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <fieldset disabled={readOnly} className="flex-1">
              <Field label={ta("f_name")} required error={error("name")}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clear("name");
                  }} autoFocus={!readOnly && !current} />
              </Field>
            </fieldset>
          </div>
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
              <Field label={ta("f_category")} className="col-span-2 sm:col-span-1">
                <Select value={categoryId} onValueChange={setCategoryId} disabled={readOnly}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ta("f_unit")}>
                <Select value={unit} onValueChange={(v) => setUnit(v as InventoryUnit)} disabled={readOnly}>
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
              <Field label={ta("f_kind")} hint={kind === "devolvible" ? ta("kind_devolvible_hint") : undefined}>
                <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)} disabled={readOnly}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suministro">{ta("kind_suministro")}</SelectItem>
                    <SelectItem value="devolvible">{ta("kind_devolvible")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowsDecimals} onChange={(e) => setAllowsDecimals(e.target.checked)} />
              {ta("f_decimals")}
            </label>

            {/* Variantes */}
            <FormSection icon={Layers} title={ta("variants")} note={ta("variants_hint")}>
              {activeVariants.map((v) => {
                const per = parseQty(v.packQty);
                const cents = priceCents(v.price);
                return (
                  <div key={v.key} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    {/* La ✕ se alinea con la caja (no con la línea «Hay: …» de abajo): arriba + el alto del título. */}
                    <div className="flex items-start gap-2">
                      <Field
                        className="min-w-0 flex-1"
                        label={ta("variant_col")}
                        hint={`${ta("stock_now")}: ${qtyWithUnit(v.stockQty, unit, lang)}`}
                      >
                        <Input
                          value={v.label}
                          onChange={(e) => patchVariant(v.key, { label: e.target.value })}
                          placeholder={activeVariants.length === 1 ? ta("variant_single") : ta("variant_label_ph")}
                        />
                      </Field>
                      {!readOnly && (
                        <button
                          type="button"
                          title={ta("variant_remove")}
                          aria-label={ta("variant_remove")}
                          disabled={activeVariants.length === 1}
                          onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                          className="mt-[24px] flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 min-[480px]:grid-cols-2">
                      <Field label={ta("col_min")}>
                        <QtyInput value={v.min} onChange={(x) => patchVariant(v.key, { min: x })} />
                      </Field>
                      <Field label={ta("col_reorder")}>
                        <QtyInput value={v.reorder} onChange={(x) => patchVariant(v.key, { reorder: x })} />
                      </Field>
                      {canCosts && (
                        <Field
                          label={ta("item_price")}
                          error={error(`price-${v.key}`)}
                          hint={
                            per != null && per > 1 && cents != null && !Number.isNaN(cents)
                              ? ta("price_pack_equiv", { t: formatCents(Math.round(cents * per)), p: v.packLabel.trim() || formatQty(per, lang) })
                              : undefined
                          }
                        >
                          <Input
                            inputMode="decimal"
                            className="text-right tabular-nums"
                            value={v.price}
                            onChange={(e) => {
                              patchVariant(v.key, { price: e.target.value });
                              clear(`price-${v.key}`);
                            }}
                            placeholder="0.00"
                          />
                        </Field>
                      )}
                    </div>
                    {/* Presentación de compra de esta variante: se pide y recibe así, sale del almacén por unidad. */}
                    {v.packOpen ? (
                      <div className="grid gap-3 min-[480px]:grid-cols-2">
                        <Field label={ta("variant_pack")}>
                          <Input
                            value={v.packLabel}
                            onChange={(e) => patchVariant(v.key, { packLabel: e.target.value })}
                            placeholder={ta("variant_pack_label_ph")}
                            disabled={readOnly}
                          />
                        </Field>
                        <Field label={ta("variant_pack_qty")} hint={unitLabel(unit, 2, lang)}>
                          <QtyInput value={v.packQty} onChange={(x) => patchVariant(v.key, { packQty: x })} disabled={readOnly} />
                        </Field>
                      </div>
                    ) : (
                      !readOnly && (
                        <button type="button" className="self-start text-xs font-medium text-primary hover:underline" onClick={() => patchVariant(v.key, { packOpen: true })}>
                          {ta("variant_pack_add")}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setVariants((vs) => [...vs, newVariant()])}>
                  <Plus className="size-3.5" />
                  {ta("add_variant")}
                </Button>
              )}
              {inactiveVariants.length > 0 && (
                <FormSection quiet icon={RotateCcw} title={ta("variants_inactive")} note={ta("variants_inactive_hint")}>
                  {inactiveVariants.map((v) => (
                    <div key={v.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {v.label || ta("variant_single")} <span className="text-[11px] tabular-nums">· {qtyWithUnit(v.stockQty, unit, lang)}</span>
                      </span>
                      {!readOnly && (
                        <span className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => patchVariant(v.key, { active: true })}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <RotateCcw className="size-3" />
                            {ta("variant_reactivate")}
                          </button>
                          {/* Si no tiene historial se borra al guardar; si tiene, sigue desactivada. */}
                          <button
                            type="button"
                            title={ta("variant_remove")}
                            aria-label={ta("variant_remove")}
                            onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                            className="flex size-7 items-center justify-center text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </FormSection>
              )}
            </FormSection>

            {/* Proveedores */}
            <FormSection icon={Truck} title={ta("suppliers")} note={ta("suppliers_hint")}>
              {links.map((l) => (
                <div key={l.key} className="grid grid-cols-[1fr_auto_28px] items-end gap-2">
                  <Field label={ta("f_supplier")}>
                    <Combo
                      options={supplierOptions}
                      value={l.supplierId}
                      onChange={(id) => patchLink(l.key, { supplierId: id })}
                      placeholder={ta("pick_supplier")}
                    />
                  </Field>
                  <label className="mb-2 flex items-center gap-1.5 text-xs">
                    <input type="radio" name="primary-supplier" checked={l.isPrimary} onChange={() => patchLink(l.key, { isPrimary: true })} />
                    {ta("primary")}
                  </label>
                  {!readOnly && (
                    <button
                      type="button"
                      title={ta("remove")}
                      aria-label={ta("remove")}
                      onClick={() => setLinks((ls) => ls.filter((x) => x.key !== l.key))}
                      className="mb-1.5 flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setLinks((ls) => [...ls, { key: newKey(), supplierId: null, isPrimary: ls.length === 0 }])}
                >
                  <Plus className="size-3.5" />
                  {ta("add_supplier_link")}
                </Button>
              )}
            </FormSection>

            <Field label={ta("notes")}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              {ta("active")}
            </label>
          </fieldset>

          {!readOnly && (
            <DialogFooter className="sm:justify-between">
              {current ? (
                <Button type="button" variant="ghost" className="basis-full justify-start text-destructive sm:basis-auto" onClick={() => void deleteItem()} disabled={saving}>
                  <Trash2 className="size-3.5" />
                  {confirmDelete ? ta("delete_item_confirm") : ta("delete_item")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="max-sm:flex-1 sm:ml-auto" onClick={() => void requestClose()} disabled={saving}>
                {ta("cancel")}
              </Button>
              <Button type="submit" className="max-sm:flex-1" disabled={saving}>
                {saving ? ta("saving") : ta("save")}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
