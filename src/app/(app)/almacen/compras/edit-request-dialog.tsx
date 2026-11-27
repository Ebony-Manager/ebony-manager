"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Archive, Camera, ExternalLink, ImagePlus, Loader2 } from "lucide-react";

import { INVENTORY_UNITS, type InventoryUnit, type PurchaseRequest, type Supplier } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { parseQty } from "@/lib/almacen/inventory";
import { editPurchaseRequestAction, setRequestNotesAction, setRequestPhotoAction } from "../actions";
import { Combo, ItemThumb, QtyInput, qtyWithUnit, useTa } from "../shared";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ICON } from "@/lib/ui/concepts";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { createClient } from "@/lib/supabase/client";
import { INVENTORY_PHOTOS_BUCKET, requestPhotoPath } from "@/lib/almacen/photos";

type Project = { id: string; name: string; active: boolean };

/** Quién puede editar una solicitud: pendiente, y quien la pidió o Compras. */
export const RequestEditContext = React.createContext<{ canEdit: (r: PurchaseRequest) => boolean; edit: (r: PurchaseRequest) => void } | null>(null);

/** El nombre de la tienda de un enlace («amazon.com»), o null si no se saca uno claro. */
export function linkSite(url: string): string | null {
  try {
    const labels = new URL(url).hostname.toLowerCase().split(".").filter(Boolean);
    // Solo el dominio de la tienda: «articulo.mercadolibre.com.pa» → «mercadolibre.com.pa».
    const two = labels.length >= 3 && labels.at(-1)!.length === 2 && labels.at(-2)!.length <= 3;
    const host = labels.slice(two ? -3 : -2).join(".");
    // Enlaces cortos de Amazon.
    if (host === "a.co" || host === "amzn.to") return "amazon.com";
    return host.length > 0 && host.length <= 30 ? host : null;
  } catch {
    return null;
  }
}

/**
 * Las notas de una solicitud (motivo, medidas, el link de Amazon): los enlaces se pueden tocar.
 * Un enlace largo se muestra con el nombre de la tienda («amazon.com ↗») para no llenar la fila y
 * saber a dónde lleva; si no se saca un nombre claro, «Ver enlace ↗».
 */
export function RequestNotes({ text, className }: { text: string | null; className?: string }) {
  const { ta } = useTa();
  if (!text?.trim()) return null;
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <span className={`block break-words text-xs text-muted-foreground ${className ?? ""}`}>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            {linkSite(p) ?? ta("link_open")}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
}

/**
 * Editar una solicitud, con los mismos campos que al crearla: foto, tipo (otra cosa / especial para proyecto, si es
 * texto libre), qué es, cantidad y unidad, proveedor (quien ve el Almacén), proyecto y link o notas.
 * Ya pedida (en camino): solo la foto y el link o las notas; lo demás ya está en el pedido y se ve de referencia.
 */
export function EditRequestDialog({
  request,
  projects,
  suppliers = [],
  onClose,
}: {
  request: PurchaseRequest | null;
  projects: Project[];
  /** Vacío = no elige proveedor (no ve el Almacén). */
  suppliers?: Supplier[];
  onClose: () => void;
}) {
  const { ta, lang } = useTa();
  const free = !!request && !request.variantId;
  const ordered = request?.status === "pedido";
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [special, setSpecial] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState<InventoryUnit>("unidad");
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"what" | "qty" | "project">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify({ special, description, qty, unit, supplierId, projectId, notes }));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- los datos de la solicitud al abrir. */
  React.useEffect(() => {
    if (!request) return;
    setSpecial(request.forProject);
    setDescription(request.description);
    setQty(String(request.qty));
    setUnit((INVENTORY_UNITS as readonly string[]).includes(request.unit ?? "") ? (request.unit as InventoryUnit) : "unidad");
    setSupplierId(request.supplierId);
    setProjectId(request.projectId);
    setNotes(request.reason ?? "");
    setPhotoPath(request.photoPath);
    setSaving(false);
    reset();
    markSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [request]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const projectOptions = React.useMemo(
    () => projects.filter((p) => p.active || p.id === projectId).map((p) => ({ value: p.id, label: p.name })),
    [projects, projectId],
  );
  const supplierOptions = React.useMemo(() => suppliers.filter((x) => x.active || x.id === supplierId).map((x) => ({ value: x.id, label: x.name })), [suppliers, supplierId]);

  // La foto se guarda al elegirla (como en el resto del Almacén).
  async function onPhotoFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !request) return;
    setPhotoBusy(true);
    try {
      setPhotoPath(await uploadRequestPhoto(request.id, file));
      toast.success(ta("photo_saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("photo_error"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    if (ordered) {
      if ((request.reason ?? "") !== notes) {
        setSaving(true);
        const res = await setRequestNotesAction(request.id, notes);
        setSaving(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(ta("saved"));
      }
      return onClose();
    }
    const n = parseQty(qty);
    if (
      !validate([
        ["what", free && !description.trim(), ta("what_required")],
        ["qty", n == null || n <= 0, ta("qty_required")],
        ["project", special && !projectId, ta("st_project_required")],
      ])
    )
      return;
    setSaving(true);
    const res = await editPurchaseRequestAction(request.id, {
      description: free ? description : undefined,
      qty: n!,
      unit: free ? unit : undefined,
      projectId,
      reason: notes,
      forProject: free ? special : undefined,
      supplierId: supplierOptions.length > 0 ? supplierId : undefined,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  const supplierName = suppliers.find((x) => x.id === request?.supplierId)?.name;
  const projectName = projects.find((p) => p.id === request?.projectId)?.name;

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("edit_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {free && !ordered && (
            <SegmentedFilter
              value={special ? "special" : "free"}
              onChange={(v) => {
                setSpecial(v === "special");
                clear("project");
              }}
              options={[
                { value: "free", label: ta("request_free"), icon: ICON.freeText },
                { value: "special", label: ta("request_special"), icon: Archive },
              ]}
            />
          )}

          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
            <PhotoButton path={photoPath} busy={photoBusy} onPick={() => fileRef.current?.click()} />
            {ordered ? (
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">{request ? requestNameText(request) : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {[request ? qtyWithUnit(request.qty, request.unit, lang) : null, supplierName, projectName].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{ta("request_ordered_limited")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{ta("request_photo_hint")}</p>
            )}
          </div>

          {!ordered && (
            <>
              {free && (
                <Field label={ta("f_what")} required error={error("what")}>
                  <Input
                    value={description}
                    onChange={(ev) => {
                      setDescription(ev.target.value);
                      clear("what");
                    }}
                    placeholder={ta("f_what_ph")}
                  />
                </Field>
              )}
              <div className="grid grid-cols-[8rem_1fr] gap-3">
                <Field label={ta("qty")} required error={error("qty")}>
                  <QtyInput
                    value={qty}
                    onChange={(v) => {
                      setQty(v);
                      clear("qty");
                    }}
                  />
                </Field>
                {free && (
                  <Field label={ta("f_unit")}>
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
                  </Field>
                )}
              </div>

              {supplierOptions.length > 0 && (
                <Field label={ta("f_supplier")}>
                  <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
                    <Combo options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder={ta("pick_supplier")} />
                    {supplierId && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSupplierId(null)}>
                        {ta("remove")}
                      </Button>
                    )}
                  </div>
                </Field>
              )}

              <Field label={ta("dest_project")} required={special} error={error("project")}>
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
                  {projectId && !special && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                      {ta("remove")}
                    </Button>
                  )}
                </div>
              </Field>
            </>
          )}

          <Field label={special ? ta("f_special_notes") : ta("f_reason")}>
            <Textarea rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder={special ? ta("f_special_notes_ph") : ta("f_reason_ph")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving || photoBusy}>
              {saving ? ta("saving") : ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}

/** Nombre de una solicitud de texto libre (o la descripción que quedó). */
function requestNameText(r: PurchaseRequest): string {
  return r.description;
}

/** Sube la foto de una solicitud y la pone (borra la anterior). Devuelve la ruta nueva. */
export async function uploadRequestPhoto(requestId: string, file: File): Promise<string> {
  const blob = await resizeToJpeg(file, 800);
  const supabase = createClient();
  const path = requestPhotoPath(requestId);
  const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const res = await setRequestPhotoAction(requestId, path);
  if (!res.ok) throw new Error(res.error);
  if (res.data?.startsWith("requests/")) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([res.data]);
  return path;
}

/** El cuadro de la foto: sin foto, «Foto» para elegir; con foto, la foto con una camarita para cambiarla. */
export function PhotoButton({ path, preview, busy, onPick, size = 72 }: { path: string | null; preview?: string | null; busy: boolean; onPick: () => void; size?: number }) {
  const { ta } = useTa();
  const has = !!(path || preview);
  return (
    <button type="button" disabled={busy} onClick={onPick} aria-label={ta("st_photo_add")} title={ta("st_photo_add")} className="relative block shrink-0 rounded-md">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local antes de subir.
        <img src={preview} alt="" style={{ width: size, height: size }} className="rounded-md border border-border bg-white object-contain" />
      ) : path ? (
        <ItemThumb path={path} size={size} />
      ) : (
        <span style={{ width: size, height: size }} className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-[11px] font-medium text-muted-foreground hover:bg-muted/60">
          {busy ? <Loader2 className={size < 56 ? "size-4 animate-spin" : "size-5 animate-spin"} /> : <ImagePlus className={size < 56 ? "size-4" : "size-5"} />}
          {size >= 56 && ta("st_photo_add")}
        </span>
      )}
      {has && (
        <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
        </span>
      )}
    </button>
  );
}
