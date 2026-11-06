"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Box, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resizeToJpeg } from "@/components/shared/profile-photo-picker";
import { createClient } from "@/lib/supabase/client";
import { photoUrl, THUMB_WIDTH } from "@/lib/photo-url";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { MAX_ITEM_IMAGES, type QuoteImage } from "@/types/cotizador";
import { addQuoteImageAction, deleteQuoteImageAction } from "../actions";

const BUCKET = "quote-images";
const MAX_SIDE = 1600;

/** Sube una imagen al bucket y la registra en el ítem; si el registro falla, borra el archivo. */
async function uploadImage(quoteId: string, sectionId: string, blob: Blob): Promise<QuoteImage> {
  const supabase = createClient();
  const path = `${quoteId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  const res = await addQuoteImageAction(sectionId, path);
  if (!res.ok) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(res.error);
  }
  return res.data;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/**
 * Imágenes de referencia del ítem (hasta 3): un pantallazo de SketchUp, de
 * un plano o una referencia, o "Usar vista 3D" (el dibujo del ítem). Van al
 * lado del ítem en la vista para el cliente y en el PDF.
 */
export function ItemImages({
  quoteId,
  sectionId,
  images,
  locked,
  ensureSaved,
  capture3d,
  onChange,
}: {
  quoteId: string;
  sectionId: string;
  images: QuoteImage[];
  locked: boolean;
  /** El ítem tiene que existir en la base antes de colgarle una imagen. */
  ensureSaved: () => Promise<void>;
  /** Toma la vista 3D actual (null si no está a la vista). */
  capture3d: () => string | null;
  onChange: (images: QuoteImage[]) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.cotizador) => t(lang, strings.cotizador[k]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const full = images.length >= MAX_ITEM_IMAGES;

  async function add(blobs: Blob[]) {
    if (!blobs.length) return;
    setBusy(true);
    try {
      await ensureSaved();
      let list = images;
      for (const blob of blobs.slice(0, MAX_ITEM_IMAGES - images.length)) {
        const img = await uploadImage(quoteId, sectionId, blob);
        list = [...list, img];
        onChange(list);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const blobs = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).map((f) => resizeToJpeg(f, MAX_SIDE)));
    await add(blobs);
  }

  async function onCapture() {
    const data = capture3d();
    if (!data) return void toast.error(tt("img_3d_hidden"));
    await add([await dataUrlToBlob(data)]);
  }

  async function remove(img: QuoteImage) {
    onChange(images.filter((i) => i.id !== img.id));
    const res = await deleteQuoteImageAction(img.id);
    if (!res.ok) {
      toast.error(res.error);
      onChange(images);
    }
  }

  if (locked && images.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/80">{tt("img_title")}</span>
      <div className="flex flex-wrap items-center gap-2">
        {images.map((img) => (
          <div key={img.id} className="group relative size-20 overflow-hidden rounded-md border border-border bg-muted">
            <a href={photoUrl(BUCKET, img.path)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de la ruta /api/foto (ya achicada y en caché). */}
              <img src={photoUrl(BUCKET, img.path, THUMB_WIDTH)} alt="" className="size-full object-cover" />
            </a>
            {!locked && (
              <button
                type="button"
                onClick={() => void remove(img)}
                aria-label={tt("img_remove")}
                title={tt("img_remove")}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {!locked && !full && (
          <>
            <Button type="button" variant="outline" size="sm" className="h-20 w-20 flex-col gap-1 text-[11px] font-medium" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {tt("img_add")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-20 w-20 flex-col gap-1 text-[11px] font-medium whitespace-normal" disabled={busy} onClick={() => void onCapture()}>
              <Box className="size-4" />
              {tt("img_use_3d")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFiles(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
