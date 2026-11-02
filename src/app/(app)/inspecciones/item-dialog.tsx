"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, Loader2, X } from "lucide-react";

import { INSPECTION_PHOTOS_BUCKET, type InspectionItem, type InspectionPainter } from "@/types/inspections";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { createClient } from "@/lib/supabase/client";
import { inspectionPhotoPath } from "@/lib/inspections/view";
import { deleteInspectionPhotoAction, updateInspectionItemAction } from "./actions";
import { DetailFields, EMPTY_META, type DetailMeta } from "./detail-fields";
import { useTi } from "./shared";
import { AreaPicker, PieceInput } from "./area-picker";

/** Lado máximo de las fotos: se ve el detalle sin subir los MB del celular. */
export const PHOTO_MAX_SIDE = 1600;

interface NewPhoto {
  key: string;
  blob: Blob;
  preview: string;
}

/** Sube las fotos al bucket privado; si algo falla, borra las que alcanzó a subir. */
export async function uploadInspectionPhotos(inspectionId: string, blobs: Blob[]): Promise<string[]> {
  const supabase = createClient();
  const done: string[] = [];
  try {
    for (const blob of blobs) {
      const path = inspectionPhotoPath(inspectionId);
      const { error } = await supabase.storage.from(INSPECTION_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      done.push(path);
    }
    return done;
  } catch (err) {
    if (done.length) await supabase.storage.from(INSPECTION_PHOTOS_BUCKET).remove(done);
    throw err;
  }
}

/** Borra del bucket fotos subidas cuyo guardado falló. */
export async function discardUploaded(paths: string[]) {
  if (paths.length) await createClient().storage.from(INSPECTION_PHOTOS_BUCKET).remove(paths);
}

/** Editar un detalle: fotos, área, comentario, tipo, pintor y responsable. */
export function ItemDialog({
  item,
  projectId,
  areas,
  pieces,
  onAreaCreated,
  painters,
  onClose,
  onSaved,
}: {
  /** null = cerrado. */
  item: InspectionItem | null;
  projectId: string;
  /** La lista fija de áreas de la obra. */
  areas: string[];
  /** Piezas ya usadas en la obra (sugerencias). */
  pieces: string[];
  onAreaCreated: (name: string) => void;
  painters: InspectionPainter[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!item;
  const { ti } = useTi();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [area, setArea] = React.useState("");
  const [piece, setPiece] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [meta, setMeta] = React.useState<DetailMeta>(EMPTY_META);
  const [photos, setPhotos] = React.useState<NewPhoto[]>([]);
  const [removed, setRemoved] = React.useState<string[]>([]);
  const [reading, setReading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const reset = React.useCallback((it: InspectionItem | null) => {
    setArea(it?.area ?? "");
    setPiece(it?.piece ?? "");
    setComment(it?.comment ?? "");
    setMeta(it ? { kind: it.kind, painterId: it.painterId, responsible: it.responsible, thirdParty: it.thirdParty } : EMPTY_META);
    setPhotos((ps) => {
      ps.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
    setRemoved([]);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- el formulario se llena al abrir */
  React.useEffect(() => {
    if (open) reset(item);
  }, [open, item, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const existing = (item?.photos ?? []).filter((p) => !removed.includes(p.id));

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setReading(true);
    try {
      const next: NewPhoto[] = [];
      for (const f of files) {
        const blob = await resizeToJpeg(f, PHOTO_MAX_SIDE);
        next.push({ key: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      }
      setPhotos((ps) => [...ps, ...next]);
    } catch {
      toast.error(ti("error"));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!item) return;
    if (!comment.trim() && photos.length === 0 && existing.length === 0) {
      toast.error(ti("need_content"));
      return;
    }
    if (meta.kind === "pintura" && !meta.painterId) {
      toast.error(ti("need_painter"));
      return;
    }
    setSaving(true);
    let uploaded: string[] = [];
    try {
      uploaded = await uploadInspectionPhotos(item.inspectionId, photos.map((p) => p.blob));
      const res = await updateInspectionItemAction(item.id, { area: area.trim() || null, piece: piece.trim() || null, comment, ...meta }, uploaded);
      if (!res.ok) throw new Error(res.error);
      for (const id of removed) await deleteInspectionPhotoAction(id);
      toast.success(ti("saved"));
      onSaved();
      onClose();
    } catch (err) {
      await discardUploaded(uploaded);
      toast.error(err instanceof Error && err.message ? err.message : ti("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ti("item_edit")}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label>{ti("f_photos")}</Label>
            <div className="flex flex-wrap gap-2">
              {existing.map((p) => (
                <Thumb key={p.id} url={p.thumb ?? p.url} after={p.kind === "despues"} onRemove={() => setRemoved((r) => [...r, p.id])} />
              ))}
              {photos.map((p) => (
                <Thumb
                  key={p.key}
                  url={p.preview}
                  onRemove={() => {
                    URL.revokeObjectURL(p.preview);
                    setPhotos((ps) => ps.filter((x) => x.key !== p.key));
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={reading || saving}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-primary/50 bg-primary/5 px-1 text-center text-[11px] leading-tight font-medium text-primary active:bg-primary/10 sm:size-24"
              >
                {reading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                {ti("take_photo")}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{ti("f_area")}</Label>
            <AreaPicker projectId={projectId} value={area} onChange={setArea} areas={areas} onCreated={onAreaCreated} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="insp-piece">
              {ti("f_piece")} <span className="font-normal text-muted-foreground">({ti("optional")})</span>
            </Label>
            <PieceInput id="insp-piece" value={piece} onChange={setPiece} pieces={pieces} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="insp-comment">{ti("f_comment")}</Label>
            <Textarea id="insp-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={ti("f_comment_ph")} />
          </div>

          <DetailFields value={meta} onChange={setMeta} painters={painters} />

          <DialogFooter className="gap-2">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:mr-auto">
                <Loader2 className="size-3.5 animate-spin" />
                {ti("uploading")}
              </span>
            )}
            <Button type="submit" disabled={saving || reading}>
              {ti("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ url, after = false, onRemove }: { url: string | null; after?: boolean; onRemove: () => void }) {
  const { ti } = useTi();
  return (
    <div className="relative size-20 overflow-hidden rounded-md border border-border bg-muted sm:size-24">
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o URL firmada */}
      {url && <img src={url} alt="" className="size-full object-cover" />}
      {after && <span className="absolute inset-x-0 bottom-0 bg-success/90 py-0.5 text-center text-[10px] font-semibold text-white">{ti("photo_after")}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={ti("photo_remove")}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/55 text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
