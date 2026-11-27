"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, ExternalLink, ImagePlus, Loader2 } from "lucide-react";

import { INVENTORY_UNITS, type InventoryUnit, type PurchaseRequest } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { parseQty } from "@/lib/almacen/inventory";
import { editPurchaseRequestAction, setRequestPhotoAction } from "../actions";
import { Combo, ItemThumb, QtyInput, useTa } from "../shared";
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

/** Editar una solicitud pendiente: qué es (si es texto libre), cantidad, proyecto y notas/link. */
export function EditRequestDialog({ request, projects, onClose }: { request: PurchaseRequest | null; projects: Project[]; onClose: () => void }) {
  const { ta } = useTa();
  const free = !!request && !request.variantId;
  // Ya pedida (en camino): solo la foto.
  const ordered = request?.status === "pedido";
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState<InventoryUnit>("unidad");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"what" | "qty" | "project">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify({ description, qty, unit, projectId, notes }));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- los datos de la solicitud al abrir. */
  React.useEffect(() => {
    if (!request) return;
    setDescription(request.description);
    setQty(String(request.qty));
    setUnit((INVENTORY_UNITS as readonly string[]).includes(request.unit ?? "") ? (request.unit as InventoryUnit) : "unidad");
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

  // La foto se guarda al elegirla (como en el resto del Almacén).
  async function onPhotoFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !request) return;
    setPhotoBusy(true);
    try {
      const blob = await resizeToJpeg(file, 800);
      const supabase = createClient();
      const path = requestPhotoPath(request.id);
      const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const res = await setRequestPhotoAction(request.id, path);
      if (!res.ok) throw new Error(res.error);
      if (res.data?.startsWith("requests/")) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([res.data]);
      setPhotoPath(path);
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
    if (ordered) return onClose();
    const n = parseQty(qty);
    if (
      !validate([
        ["what", free && !description.trim(), ta("what_required")],
        ["qty", n == null || n <= 0, ta("qty_required")],
        ["project", request.forProject && !projectId, ta("st_project_required")],
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
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("edit_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
            <button type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()} aria-label={ta("photo_change")} className="relative block shrink-0 rounded-md">
              {photoPath ? (
                <ItemThumb path={photoPath} size={72} />
              ) : (
                <span className="flex size-[72px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-[11px] font-medium text-muted-foreground hover:bg-muted/60">
                  {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  {ta("st_photo_add")}
                </span>
              )}
              {photoPath && (
                <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                  {photoBusy ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                </span>
              )}
            </button>
            <p className="text-xs text-muted-foreground">{ordered ? ta("request_ordered_photo_only") : ta("request_photo_hint")}</p>
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
          <Field label={ta("dest_project")} required={request?.forProject} error={error("project")}>
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
              {projectId && !request?.forProject && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                  {ta("remove")}
                </Button>
              )}
            </div>
          </Field>
          <Field label={request?.forProject ? ta("f_special_notes") : ta("f_reason")}>
            <Textarea rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder={request?.forProject ? ta("f_special_notes_ph") : ta("f_reason_ph")} />
          </Field>
          </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving || photoBusy}>
              {ordered ? ta("request_done") : saving ? ta("saving") : ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
