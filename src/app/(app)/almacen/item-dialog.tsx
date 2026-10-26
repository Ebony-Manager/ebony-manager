"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, ImagePlus, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";

import { INVENTORY_UNITS, type InventoryCategory, type InventoryItem, type InventoryUnit, type ItemKind, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatQty, formatUnitCost, parseQty } from "@/lib/almacen/inventory";
import { INVENTORY_PHOTOS_BUCKET, inventoryPhotoPath } from "@/lib/almacen/photos";
import { createClient } from "@/lib/supabase/client";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { Field } from "../contratistas/field";
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
}

interface SupplierDraft {
  key: string;
  supplierId: string | null;
  isPrimary: boolean;
  packLabel: string;
  packQty: string;
}

const NONE = "none";
/** Columnas de la fila de variante: nombre, mínimo, pedir hasta, quitar. */
const VARIANT_COLS = "grid-cols-[minmax(0,1fr)_64px_84px_36px] sm:grid-cols-[minmax(0,1fr)_88px_104px_36px]";
let seq = 0;
const newKey = () => `k${++seq}`;

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
  const [error, setError] = React.useState<string | null>(null);
  // Foto: en un producto existente se sube al elegirla; en uno nuevo, al guardarlo.
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = React.useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [armPhotoRemove, setArmPhotoRemove] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

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
          }))
        : [{ key: newKey(), label: "", min: "", reorder: "", active: true, stockQty: 0, unitCostCents: null }],
    );
    setLinks(
      (current?.suppliers ?? []).map((s) => ({
        key: newKey(),
        supplierId: s.supplierId,
        isPrimary: s.isPrimary,
        packLabel: s.packLabel ?? "",
        packQty: s.packQty != null ? String(s.packQty) : "",
      })),
    );
    setError(null);
  }, [item, current]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    if (!res.ok) return setError(res.error);
    toast.success(ta("item_deleted"));
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(ta("name_required"));
    const input = {
      name,
      categoryId: categoryId === NONE ? null : categoryId,
      unit,
      allowsDecimals,
      kind,
      notes,
      active,
      variants: variants.map((v) => ({ id: v.id, label: v.label, minQty: parseQty(v.min), reorderQty: parseQty(v.reorder), active: v.active })),
      suppliers: links
        .filter((l) => l.supplierId)
        .map((l) => ({ supplierId: l.supplierId!, isPrimary: l.isPrimary, packLabel: l.packLabel, packQty: parseQty(l.packQty) })),
    };
    setSaving(true);
    const res = current ? await updateItemAction(current.id, input) : await createItemAction(input);
    if (res.ok && !current && pendingPhoto && typeof res.data === "string") {
      await uploadPhoto(res.data, pendingPhoto.blob, null).catch(() => toast.error(ta("photo_error")));
    }
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("saved"));
    if (typeof res.data === "number" && res.data > 0) toast(ta("variants_deactivated_toast", { n: res.data }));
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
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
              <Field label={ta("f_name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!readOnly && !current} />
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
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold">{ta("variants")}</h3>
                <p className="text-xs text-muted-foreground">{ta("variants_hint")}</p>
              </div>
              {/* Una fila por variante: nombre (con su existencia debajo), mínimo, pedir hasta y quitar. */}
              <div className={`grid ${VARIANT_COLS} gap-2 text-[11px] font-medium text-muted-foreground`}>
                <span>{ta("variant_col")}</span>
                <span className="text-right">{ta("min_short")}</span>
                <span className="text-right">{ta("reorder_short")}</span>
                <span />
              </div>
              {activeVariants.map((v) => (
                <div key={v.key} className={`grid ${VARIANT_COLS} items-start gap-2`}>
                  <div className="min-w-0">
                    <Input
                      className="h-9"
                      value={v.label}
                      onChange={(e) => patchVariant(v.key, { label: e.target.value })}
                      placeholder={activeVariants.length === 1 ? ta("variant_single") : ta("variant_label_ph")}
                    />
                    <p className="mt-0.5 truncate px-1 text-[11px] tabular-nums text-muted-foreground">
                      {qtyWithUnit(v.stockQty, unit, lang)}
                      {canCosts && v.unitCostCents != null && ` · ${formatUnitCost(v.unitCostCents)}`}
                    </p>
                  </div>
                  <QtyInput value={v.min} onChange={(x) => patchVariant(v.key, { min: x })} placeholder="—" aria-label={ta("col_min")} />
                  <QtyInput value={v.reorder} onChange={(x) => patchVariant(v.key, { reorder: x })} placeholder="—" aria-label={ta("col_reorder")} />
                  {!readOnly && (
                    <button
                      type="button"
                      title={ta("variant_remove")}
                      aria-label={ta("variant_remove")}
                      disabled={activeVariants.length === 1}
                      onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                      className="flex size-9 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"
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
                  onClick={() =>
                    setVariants((vs) => [...vs, { key: newKey(), label: "", min: "", reorder: "", active: true, stockQty: 0, unitCostCents: null }])
                  }
                >
                  <Plus className="size-3.5" />
                  {ta("add_variant")}
                </Button>
              )}
              {inactiveVariants.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 rounded-md border border-dashed border-border px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {ta("variants_inactive")} · <span className="font-normal">{ta("variants_inactive_hint")}</span>
                  </p>
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
                </div>
              )}
            </div>

            {/* Proveedores */}
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-semibold">{ta("suppliers")}</h3>
                <p className="text-xs text-muted-foreground">{ta("suppliers_hint")}</p>
              </div>
              {links.map((l) => (
                <div key={l.key} className="grid grid-cols-[1fr_28px] items-center gap-2 sm:grid-cols-[1fr_1fr_80px_auto_28px]">
                  <Combo
                    options={supplierOptions}
                    value={l.supplierId}
                    onChange={(id) => patchLink(l.key, { supplierId: id })}
                    placeholder={ta("pick_supplier")}
                  />
                  <Input
                    className="col-span-2 sm:col-span-1"
                    value={l.packLabel}
                    onChange={(e) => patchLink(l.key, { packLabel: e.target.value })}
                    placeholder={ta("pack_label_ph")}
                  />
                  <QtyInput
                    value={l.packQty}
                    onChange={(x) => patchLink(l.key, { packQty: x })}
                    placeholder={formatQty(1, lang)}
                    aria-label={ta("pack_label_ph")}
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" name="primary-supplier" checked={l.isPrimary} onChange={() => patchLink(l.key, { isPrimary: true })} />
                    {ta("primary")}
                  </label>
                  {!readOnly && (
                    <button
                      type="button"
                      title={ta("remove")}
                      onClick={() => setLinks((ls) => ls.filter((x) => x.key !== l.key))}
                      className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
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
                  onClick={() => setLinks((ls) => [...ls, { key: newKey(), supplierId: null, isPrimary: ls.length === 0, packLabel: "", packQty: "" }])}
                >
                  <Plus className="size-3.5" />
                  {ta("add_supplier_link")}
                </Button>
              )}
            </div>

            <Field label={ta("notes")}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              {ta("active")}
            </label>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!readOnly && (
            <DialogFooter className="sm:justify-between">
              {current ? (
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => void deleteItem()} disabled={saving}>
                  <Trash2 className="size-3.5" />
                  {confirmDelete ? ta("delete_item_confirm") : ta("delete_item")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                  {ta("cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? ta("saving") : ta("save")}
                </Button>
              </div>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
