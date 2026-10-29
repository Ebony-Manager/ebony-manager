"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, HandHelping, ImagePlus, Loader2, Trash2, Undo2 } from "lucide-react";

import { TOOL_CATEGORIES, type InventoryPerson, type Tool, type ToolCategory, type ToolLoan, type ToolStatus } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { createClient } from "@/lib/supabase/client";
import { INVENTORY_PHOTOS_BUCKET, toolPhotoPath } from "@/lib/almacen/photos";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { parseQty } from "@/lib/almacen/inventory";
import { shownStatus, toolName } from "@/lib/almacen/tools";
import { Field } from "../../contratistas/field";
import { createToolAction, setToolPhotoAction, updateToolAction } from "../actions";
import { ItemThumb, QtyInput, useTa } from "../shared";
import { ToolStatusBadge, holderName, useDueText } from "./common";

type EditableStatus = Exclude<ToolStatus, "prestada">;
const EDITABLE_STATUSES: EditableStatus[] = ["disponible", "reparacion", "danada", "perdida"];

/**
 * Ficha de una herramienta: sus datos (editables con Ajustes de inventario o
 * Compras), quién la tiene ahora y su historial de préstamos. El estado
 * "prestada" no se pone a mano: se presta o se devuelve.
 */
export function ToolDialog({
  tool,
  loans,
  people,
  projects,
  canEdit,
  onClose,
  onReturn,
  onLend,
}: {
  tool: Tool | "new" | null;
  loans: ToolLoan[];
  people: Map<string, InventoryPerson>;
  projects: Map<string, string>;
  canEdit: boolean;
  onClose: () => void;
  onReturn: (loan: ToolLoan) => void;
  onLend: (toolId: string) => void;
}) {
  const { ta, lang } = useTa();
  const dueText = useDueText();
  const today = todayInPanama();
  const current = tool && tool !== "new" ? tool : null;
  const readOnly = !canEdit;

  const [name, setName] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [category, setCategory] = React.useState<ToolCategory>("electrica");
  const [brand, setBrand] = React.useState("");
  const [status, setStatus] = React.useState<EditableStatus>("disponible");
  const [notes, setNotes] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = React.useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [armPhotoRemove, setArmPhotoRemove] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!tool) return;
    setName(current?.name ?? "");
    setNumber(current?.number != null ? String(current.number) : "");
    setCategory(current?.category ?? "electrica");
    setBrand(current?.brand ?? "");
    setStatus(current && current.status !== "prestada" ? current.status : "disponible");
    setNotes(current?.notes ?? "");
    setActive(current?.active ?? true);
    setPhotoPath(current?.photoPath ?? null);
    setPendingPhoto(null);
    setError(null);
  }, [tool, current]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const history = current ? loans.filter((l) => l.toolId === current.id) : [];
  const openLoan = history.find((l) => l.returnedOn == null);
  const lent = current?.status === "prestada";

  async function uploadPhoto(toolId: string, blob: Blob, oldPath: string | null): Promise<string> {
    const supabase = createClient();
    const path = toolPhotoPath(toolId);
    const up = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const res = await setToolPhotoAction(toolId, path);
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
    const res = await setToolPhotoAction(current.id, null);
    if (res.ok && photoPath) await createClient().storage.from(INVENTORY_PHOTOS_BUCKET).remove([photoPath]);
    setPhotoBusy(false);
    if (!res.ok) return toast.error(res.error);
    setPhotoPath(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(ta("tool_name_required"));
    const n = parseQty(number);
    const input = {
      name,
      number: n != null && n > 0 ? Math.round(n) : null,
      category,
      brand: brand || null,
      notes: notes || null,
      status,
      active,
    };
    setSaving(true);
    const res = current ? await updateToolAction(current.id, input, current.status) : await createToolAction(input);
    if (res.ok && !current && pendingPhoto && typeof res.data === "string") {
      await uploadPhoto(res.data, pendingPhoto.blob, null).catch(() => toast.error(ta("photo_error")));
    }
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("tool_saved"));
    onClose();
  }

  return (
    <Dialog open={!!tool} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {current ? toolName(current) : ta("new_tool")}
            {current && <ToolStatusBadge status={shownStatus(current, openLoan, today)} />}
          </DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex items-start gap-4">
            {/* La foto es el botón, igual que en la ficha del producto. */}
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
                    <button type="button" disabled={photoBusy} aria-label={ta("photo_change")} className="relative block rounded-md">
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
            <fieldset disabled={readOnly} className="grid flex-1 grid-cols-[1fr_72px] gap-x-3 gap-y-4">
              <Field label={ta("tool_f_name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={ta("tool_f_name_ph")} autoFocus={!readOnly && !current} />
              </Field>
              <Field label={ta("tool_f_number")}>
                <QtyInput value={number} onChange={setNumber} placeholder="—" inputMode="numeric" />
              </Field>
            </fieldset>
          </div>

          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Field label={ta("tool_f_category")}>
                <Select value={category} onValueChange={(v) => setCategory(v as ToolCategory)} disabled={readOnly}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ta(`tool_cat_${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ta("tool_f_status")} hint={lent ? ta("tool_status_locked") : undefined}>
                <Select value={lent ? "prestada" : status} onValueChange={(v) => setStatus(v as EditableStatus)} disabled={readOnly || lent}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lent && <SelectItem value="prestada">{ta("tool_st_prestada")}</SelectItem>}
                    {EDITABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ta(`tool_st_${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={ta("tool_f_brand")}>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={ta("optional")} />
            </Field>
            <Field label={ta("notes")}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ta("optional")} />
            </Field>
            {current && !readOnly && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={!active} onChange={(e) => setActive(!e.target.checked)} disabled={lent} />
                {ta("tool_inactive_hint")}
              </label>
            )}
          </fieldset>

          {/* Ahora: quién la tiene (Devolver) o, si está en el almacén, Prestar. */}
          {current && (lent && openLoan ? (
            <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <h3 className="text-xs font-semibold text-muted-foreground">{ta("tool_now")}</h3>
              <p className="font-medium">{ta("tool_with", { p: holderName(openLoan, people) })}</p>
              <p className="text-xs text-muted-foreground">
                {[openLoan.projectId ? projects.get(openLoan.projectId) : null, `${formatDateCompact(lang, openLoan.lentOn)} → ${dueText(openLoan.dueOn, today)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onReturn(openLoan)}>
                <Undo2 className="size-3.5" />
                {ta("give_back")}
              </Button>
            </section>
          ) : current.status === "disponible" && current.active ? (
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onLend(current.id)}>
              <HandHelping className="size-3.5" />
              {ta("lend")}
            </Button>
          ) : null)}

          {current && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{ta("tool_history")}</h3>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{ta("tool_history_empty")}</p>
              ) : (
                <ul className="flex flex-col rounded-lg border border-border text-sm">
                  {history.map((l) => (
                    <li key={l.id} className="flex flex-col gap-0.5 border-b border-border px-3 py-2 last:border-0">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{holderName(l, people)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatDateCompact(lang, l.lentOn)} → {l.returnedOn ? formatDateCompact(lang, l.returnedOn) : "…"}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          l.projectId ? projects.get(l.projectId) : null,
                          l.returnCondition ? ta(`cond_${l.returnCondition}`) : null,
                          l.lentByName ? ta("tool_lent_by", { p: l.lentByName }) : null,
                          l.returnNotes || l.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!readOnly && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                {ta("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? ta("saving") : ta("save")}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
