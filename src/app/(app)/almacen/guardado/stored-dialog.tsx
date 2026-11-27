"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, ImagePlus, Loader2, ShoppingCart, UserRound } from "lucide-react";

import type { StoredItem, Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { Field } from "@/components/shared/field";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { createClient } from "@/lib/supabase/client";
import { INVENTORY_PHOTOS_BUCKET, storedPhotoPath } from "@/lib/almacen/photos";
import { parseQty } from "@/lib/almacen/inventory";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { ICON } from "@/lib/ui/concepts";
import { Combo, ItemThumb, QtyInput, useTa } from "../shared";
import {
  createStoredItemAction,
  deleteStoredItemAction,
  getStoredProjectItemsAction,
  setStoredItemPhotoAction,
  updateStoredItemAction,
} from "./actions";

type Project = { id: string; name: string; active: boolean };

/**
 * Registrar (lo que trajo el cliente o lo que Ebony ya compró y llegó) o ver/editar algo guardado para un proyecto.
 * Lo que vino de Compras solo cambia el ítem, dónde está y las notas: lo demás es de la compra.
 */
export function StoredDialog({
  item,
  defaultProjectId,
  projects,
  suppliers,
  canCosts,
  onClose,
  onDeliver,
}: {
  /** "new" = registrar; null = cerrado. */
  item: StoredItem | "new" | null;
  defaultProjectId?: string | null;
  projects: Project[];
  suppliers: Supplier[];
  canCosts: boolean;
  onClose: () => void;
  onDeliver: (item: StoredItem) => void;
}) {
  const { ta } = useTa();
  const isNew = item === "new";
  const current = item && item !== "new" ? item : null;
  const fromPurchase = current?.origin === "compra";

  const [origin, setOrigin] = React.useState<"cliente" | "directa">("cliente");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectItemId, setProjectItemId] = React.useState<string | null>(null);
  // Los ítems del último proyecto consultado (solo se muestran si es el elegido).
  const [loadedItems, setLoadedItems] = React.useState<{ projectId: string; list: { id: string; label: string }[] } | null>(null);
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [location, setLocation] = React.useState("");
  const [receivedOn, setReceivedOn] = React.useState(todayInPanama());
  const [cost, setCost] = React.useState("");
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = React.useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { error, validate, clear, reset } = useFormErrors<"project" | "what" | "qty">();
  const { isDirty, markSeeded } = useFormBaseline(() =>
    JSON.stringify({ origin, projectId, projectItemId, description, qty, location, receivedOn, cost, supplierId, notes, photo: !!pendingPhoto }),
  );
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario al abrir. */
  React.useEffect(() => {
    if (!item) return;
    setOrigin(current?.origin === "directa" ? "directa" : "cliente");
    setProjectId(current?.projectId ?? defaultProjectId ?? null);
    setProjectItemId(current?.projectItemId ?? null);
    setDescription(current?.description ?? "");
    setQty(String(current?.qty ?? 1));
    setLocation(current?.location ?? "");
    setReceivedOn(current?.receivedOn ?? todayInPanama());
    setCost(current?.totalCents != null ? (current.totalCents / 100).toFixed(2) : "");
    setSupplierId(current?.supplierId ?? null);
    setNotes(current?.notes ?? "");
    setPhotoPath(current?.photoPath ?? null);
    setPendingPhoto(null);
    setSaving(false);
    reset();
    markSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Los ítems del proyecto elegido (para decir "es para el closet principal").
  React.useEffect(() => {
    if (!item || !projectId) return;
    let alive = true;
    void getStoredProjectItemsAction(projectId).then((res) => alive && setLoadedItems({ projectId, list: res.ok ? res.data : [] }));
    return () => {
      alive = false;
    };
  }, [item, projectId]);
  const projectItems = loadedItems && loadedItems.projectId === projectId ? loadedItems.list : [];

  const projectOptions = React.useMemo(
    () => projects.filter((p) => p.active || p.id === projectId).map((p) => ({ value: p.id, label: p.name })),
    [projects, projectId],
  );
  const supplierOptions = React.useMemo(() => suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name })), [suppliers]);
  const kind = fromPurchase ? "compra" : origin;
  // El costo: se pone al registrar lo que Ebony ya compró; después lo ve y lo cambia quien ve costos.
  const showCost = kind === "directa" && (isNew || canCosts);

  async function uploadPhoto(id: string, blob: Blob, oldPath: string | null): Promise<string> {
    const supabase = createClient();
    const path = storedPhotoPath(id);
    const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const res = await setStoredItemPhotoAction(id, path);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseQty(qty);
    if (
      !validate([
        ["project", !projectId, ta("st_project_required")],
        ["what", !description.trim(), ta("st_what_required")],
        ["qty", n == null || n <= 0, ta("st_qty_required")],
      ])
    )
      return;
    const c = parseQty(cost);
    const input = {
      projectId: projectId!,
      projectItemId,
      description,
      qty: n!,
      unit: current?.unit ?? null,
      location,
      notes,
      receivedOn,
      supplierId: kind === "directa" ? supplierId : null,
      totalCents: kind === "directa" && c != null ? Math.round(c * 100) : null,
      origin: fromPurchase ? undefined : origin,
    };
    setSaving(true);
    if (current) {
      const res = await updateStoredItemAction(current.id, current.origin, input);
      setSaving(false);
      if (!res.ok) return void toast.error(res.error);
    } else {
      const res = await createStoredItemAction(origin, input);
      if (!res.ok) {
        setSaving(false);
        return void toast.error(res.error);
      }
      if (pendingPhoto) await uploadPhoto(res.data, pendingPhoto.blob, null).catch(() => toast.error(ta("photo_error")));
      setSaving(false);
    }
    toast.success(ta("st_saved"));
    onClose();
  }

  async function onDelete() {
    if (!current) return;
    const res = await deleteStoredItemAction(current.id);
    if (!res.ok) return void toast.error(res.error);
    if (res.data) await createClient().storage.from(INVENTORY_PHOTOS_BUCKET).remove([res.data]);
    toast.success(ta("st_deleted"));
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && void requestClose()}>
      {/* Al editar, sin foco automático: si no, la primera opción del origen sale marcada en azul y parece la elegida. */}
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto" onOpenAutoFocus={isNew ? undefined : (e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isNew ? ta("st_register_title") : ta("st_edit_title")}</DialogTitle>
          {fromPurchase && <DialogDescription>{ta("st_from_purchase")}</DialogDescription>}
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {!fromPurchase && (
            <div className="flex flex-col gap-1.5">
              <SegmentedFilter
                fill
                value={origin}
                onChange={setOrigin}
                options={[
                  { value: "cliente", label: ta("st_origin_cliente"), icon: UserRound },
                  { value: "directa", label: ta("st_origin_directa"), icon: ShoppingCart },
                ]}
              />
              <p className="text-xs text-muted-foreground">{origin === "cliente" ? ta("st_origin_hint_cliente") : ta("st_origin_hint_directa")}</p>
            </div>
          )}

          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                title={ta("photo_change")}
                aria-label={ta("st_photo_add")}
                className="relative block rounded-md"
              >
                {pendingPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vista previa local antes de subir.
                  <img src={pendingPhoto.preview} alt="" className="size-[88px] rounded-md border border-border bg-white object-contain" />
                ) : photoPath ? (
                  <ItemThumb path={photoPath} size={88} />
                ) : (
                  <span className="flex size-[88px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-[11px] font-medium text-muted-foreground hover:bg-muted/60">
                    {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                    {ta("st_photo_add")}
                  </span>
                )}
                {(pendingPhoto || photoPath) && (
                  <span className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                    {photoBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                  </span>
                )}
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Field label={ta("st_f_what")} required error={error("what")}>
                <Input
                  value={description}
                  disabled={fromPurchase}
                  onChange={(ev) => {
                    setDescription(ev.target.value);
                    clear("what");
                  }}
                  placeholder={ta("st_f_what_ph")}
                  autoFocus={isNew}
                />
              </Field>
              <Field label={ta("qty")} required error={error("qty")} className="w-28">
                <QtyInput
                  value={qty}
                  disabled={fromPurchase}
                  onChange={(v) => {
                    setQty(v);
                    clear("qty");
                  }}
                />
              </Field>
            </div>
          </div>

          <Field label={ta("st_f_project")} icon={ICON.project} required error={error("project")}>
            {fromPurchase ? (
              <Input value={current?.projectName ?? ""} disabled />
            ) : (
              <Combo
                options={projectOptions}
                value={projectId}
                onChange={(id) => {
                  setProjectId(id);
                  setProjectItemId(null);
                  clear("project");
                }}
                placeholder={ta("pick_project")}
              />
            )}
          </Field>

          {projectItems.length > 0 && (
            <Field label={ta("st_f_item")}>
              <Select value={projectItemId ?? "__none"} onValueChange={(v) => setProjectItemId(v === "__none" ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{ta("st_f_item_none")}</SelectItem>
                  {projectItems.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label={ta("st_f_location")} icon={ICON.location}>
            <Input value={location} onChange={(ev) => setLocation(ev.target.value)} placeholder={ta("st_f_location_ph")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <Field label={ta("st_f_received_on")} icon={ICON.date}>
              <Input type="date" value={receivedOn} disabled={fromPurchase} onChange={(ev) => ev.target.value && setReceivedOn(ev.target.value)} />
            </Field>
            {showCost && (
              <Field label={ta("st_f_cost")} hint={ta("st_f_cost_hint")}>
                <QtyInput value={cost} onChange={setCost} placeholder="0.00" />
              </Field>
            )}
          </div>

          {kind === "directa" && supplierOptions.length > 0 && (
            <Field label={ta("f_supplier")}>
              <Combo options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder={ta("pick_supplier")} />
            </Field>
          )}

          <Field label={ta("st_f_notes")}>
            <Textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </Field>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {current && !fromPurchase && <ConfirmButton label={ta("st_delete")} confirmLabel={ta("st_delete_confirm")} onConfirm={() => void onDelete()} />}
              {current?.status === "en_almacen" && (
                <Button type="button" variant="outline" onClick={() => onDeliver(current)}>
                  {ta("st_deliver")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
                {ta("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? ta("saving") : ta("save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
