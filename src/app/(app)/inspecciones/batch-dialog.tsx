"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, Combine, Loader2, Plus, Trash2, X } from "lucide-react";

import type { InspectionPainter } from "@/types/inspections";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { addInspectionItemsAction } from "./actions";
import { DetailFields, EMPTY_META, type DetailMeta } from "./detail-fields";
import { AreaInput, PHOTO_MAX_SIDE, discardUploaded, uploadInspectionPhotos } from "./item-dialog";
import { useTi } from "./shared";

interface DraftPhoto {
  key: string;
  blob: Blob;
  preview: string;
}

interface Draft {
  key: string;
  photos: DraftPhoto[];
  comment: string;
  meta: DetailMeta;
}

const newDraft = (meta: DetailMeta, photos: DraftPhoto[] = []): Draft => ({ key: crypto.randomUUID(), photos, comment: "", meta });

/**
 * Agregar detalles de un área de una vez: el área se elige una vez; cada foto
 * es un detalle (con su comentario, tipo, pintor y responsable), y dos fotos
 * del mismo detalle se juntan con «Unir con el anterior». El tipo, el pintor y
 * el responsable se copian del detalle anterior. "Guardar y otra área" deja el
 * diálogo abierto para seguir recorriendo la obra.
 */
export function BatchDialog({
  inspectionId,
  areas,
  painters,
  onClose,
  onSaved,
}: {
  /** null = cerrado. */
  inspectionId: string | null;
  areas: string[];
  painters: InspectionPainter[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { ti } = useTi();
  const open = !!inspectionId;
  const fileRef = React.useRef<HTMLInputElement>(null);
  // A qué detalle van las fotos que se elijan (null = cada una es un detalle nuevo).
  const target = React.useRef<string | null>(null);
  const [area, setArea] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [reading, setReading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const clearDrafts = React.useCallback(() => {
    setDrafts((ds) => {
      ds.forEach((d) => d.photos.forEach((p) => URL.revokeObjectURL(p.preview)));
      return [];
    });
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- se limpia al abrir */
  React.useEffect(() => {
    if (!open) return;
    setArea("");
    clearDrafts();
  }, [open, clearDrafts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const lastMeta = (ds: Draft[]) => (ds.length ? { ...ds[ds.length - 1].meta } : EMPTY_META);
  const patch = (key: string, p: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p } : d)));

  function pickPhotos(forDraft: string | null) {
    target.current = forDraft;
    fileRef.current?.click();
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setReading(true);
    try {
      const photos: DraftPhoto[] = [];
      for (const f of files) {
        const blob = await resizeToJpeg(f, PHOTO_MAX_SIDE);
        photos.push({ key: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      }
      const into = target.current;
      setDrafts((ds) =>
        into ? ds.map((d) => (d.key === into ? { ...d, photos: [...d.photos, ...photos] } : d)) : [...ds, ...photos.map((p) => newDraft(lastMeta(ds), [p]))],
      );
    } catch {
      toast.error(ti("error"));
    } finally {
      setReading(false);
    }
  }

  function merge(index: number) {
    setDrafts((ds) => {
      if (index <= 0) return ds;
      const prev = ds[index - 1];
      const cur = ds[index];
      const comment = [prev.comment.trim(), cur.comment.trim()].filter(Boolean).join("\n");
      return [...ds.slice(0, index - 1), { ...prev, photos: [...prev.photos, ...cur.photos], comment }, ...ds.slice(index + 1)];
    });
  }

  function remove(key: string) {
    setDrafts((ds) => {
      ds.find((d) => d.key === key)?.photos.forEach((p) => URL.revokeObjectURL(p.preview));
      return ds.filter((d) => d.key !== key);
    });
  }

  function removePhoto(draftKey: string, photoKey: string) {
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.key !== draftKey) return d;
        const gone = d.photos.find((p) => p.key === photoKey);
        if (gone) URL.revokeObjectURL(gone.preview);
        return { ...d, photos: d.photos.filter((p) => p.key !== photoKey) };
      }),
    );
  }

  async function save(nextArea: boolean) {
    if (!inspectionId || drafts.length === 0) return;
    if (drafts.some((d) => !d.comment.trim() && d.photos.length === 0)) return toast.error(ti("need_content"));
    if (drafts.some((d) => d.meta.kind === "pintura" && !d.meta.painterId)) return toast.error(ti("need_painter"));
    setSaving(true);
    const uploaded: string[] = [];
    try {
      const entries = [];
      for (const d of drafts) {
        const paths = await uploadInspectionPhotos(inspectionId, d.photos.map((p) => p.blob));
        uploaded.push(...paths);
        entries.push({ input: { area: area.trim() || null, comment: d.comment, ...d.meta }, photoPaths: paths });
      }
      const res = await addInspectionItemsAction(inspectionId, entries);
      if (!res.ok) throw new Error(res.error);
      toast.success(ti("saved"));
      onSaved();
      if (nextArea) {
        setArea("");
        clearDrafts();
      } else {
        onClose();
      }
    } catch (err) {
      await discardUploaded(uploaded);
      toast.error(err instanceof Error && err.message ? err.message : ti("error"));
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || reading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[94dvh] max-w-xl gap-3 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ti("batch_title")}</DialogTitle>
          <DialogDescription>{ti("batch_hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batch-area">{ti("area_for_all")}</Label>
          <AreaInput id="batch-area" value={area} onChange={setArea} areas={areas} />
        </div>

        {drafts.length === 0 ? (
          <button
            type="button"
            onClick={() => pickPhotos(null)}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-4 py-8 text-sm font-medium text-primary active:bg-primary/10"
          >
            {reading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
            {ti("add_photos")}
            <span className="text-xs font-normal text-muted-foreground">{ti("batch_empty")}</span>
          </button>
        ) : (
          <ol className="flex flex-col gap-3">
            {drafts.map((d, i) => (
              <li key={d.key} className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{ti("detail_n", { n: i + 1 })}</span>
                  <div className="flex items-center gap-1">
                    {i > 0 && (
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => merge(i)} disabled={busy}>
                        <Combine className="size-3.5" />
                        {ti("merge_prev")}
                      </Button>
                    )}
                    <Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground" onClick={() => remove(d.key)} disabled={busy} aria-label={ti("remove_detail")} title={ti("remove_detail")}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.photos.map((p) => (
                    <div key={p.key} className="relative size-16 overflow-hidden rounded-md border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
                      <img src={p.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(d.key, p.key)}
                        aria-label={ti("photo_remove")}
                        className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => pickPhotos(d.key)}
                    disabled={busy}
                    aria-label={ti("add_photo_here")}
                    title={ti("add_photo_here")}
                    className="flex size-16 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <Textarea rows={2} value={d.comment} onChange={(e) => patch(d.key, { comment: e.target.value })} placeholder={ti("f_comment_ph")} className="text-sm" />
                <DetailFields size="sm" value={d.meta} onChange={(meta) => patch(d.key, { meta })} painters={painters} />
              </li>
            ))}
          </ol>
        )}

        {drafts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => pickPhotos(null)} disabled={busy}>
              {reading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {ti("add_photos")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDrafts((ds) => [...ds, newDraft(lastMeta(ds))])} disabled={busy}>
              <Plus className="size-4" />
              {ti("add_without_photo")}
            </Button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />

        <DialogFooter className="gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:mr-auto">
              <Loader2 className="size-3.5 animate-spin" />
              {ti("uploading")}
            </span>
          )}
          <Button type="button" variant="outline" disabled={busy || drafts.length === 0} onClick={() => void save(true)}>
            {ti("save_next_area")}
          </Button>
          <Button type="button" disabled={busy || drafts.length === 0} onClick={() => void save(false)}>
            {drafts.length === 1 ? ti("save_1") : ti("save_n", { n: drafts.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
