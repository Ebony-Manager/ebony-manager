"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, Loader2, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

const MAX_SIDE = 512;

/** Reduce la foto a máx. 512 px (o `maxSide`) y la convierte a JPEG (suele
 *  quedar en ~50 KB): el celular entrega fotos de varios MB que no hacen falta. */
export async function resizeToJpeg(file: File, maxSide = MAX_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85)
  );
}

/**
 * La foto de perfil se pone tocando el avatar (empleados y contratistas):
 * sin foto, abre directo el selector de archivo (en el celular ofrece la
 * cámara); con foto, un menú con "Cambiar foto" y "Quitar foto". Sube al
 * bucket PRIVADO con la sesión del usuario (la RLS de storage pide el
 * módulo), guarda la ruta con `savePath` y borra la foto anterior.
 */
export function ProfilePhotoPicker({
  bucket,
  ownerId,
  currentPath,
  hasPhoto,
  savePath,
  onPhotoChange,
  children,
}: {
  bucket: "employee-photos" | "contractor-photos";
  ownerId: string;
  currentPath: string | null;
  hasPhoto: boolean;
  /** Guarda la nueva ruta (o null) en la ficha — el server action de cada módulo. */
  savePath: (path: string | null) => Promise<unknown>;
  onPhotoChange: (url: string | null, path: string | null) => void;
  /** El avatar a mostrar (con la foto o la inicial). */
  children: React.ReactNode;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.common) => t(lang, strings.common[k]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await resizeToJpeg(file);
      const supabase = createClient();
      const path = `${ownerId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await savePath(path);
      if (currentPath) await supabase.storage.from(bucket).remove([currentPath]);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      onPhotoChange(data?.signedUrl ?? null, path);
      toast.success(tt("photo_saved"));
    } catch (err) {
      console.error("No se pudo guardar la foto", err);
      toast.error(tt("photo_error"));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await savePath(null);
      if (currentPath) await createClient().storage.from(bucket).remove([currentPath]);
      onPhotoChange(null, null);
      toast.success(tt("photo_removed"));
    } catch (err) {
      console.error("No se pudo quitar la foto", err);
      toast.error(tt("photo_error"));
    } finally {
      setBusy(false);
    }
  }

  const label = hasPhoto ? tt("photo_change") : tt("photo_add");
  const face = (
    <span className="relative inline-flex rounded-full">
      {children}
      {/* Cámara encima al pasar el mouse (o mientras sube). */}
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity ${
          busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
      </span>
    </span>
  );
  const buttonClass = "group inline-flex w-fit shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {hasPhoto ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={busy} title={label} aria-label={label} className={buttonClass}>
              {face}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
              <Camera className="size-3.5" />
              {tt("photo_change")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void onRemove()}>
              <Trash2 className="size-3.5" />
              {tt("photo_remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          disabled={busy}
          title={label}
          aria-label={label}
          onClick={() => inputRef.current?.click()}
          className={buttonClass}
        >
          {face}
        </button>
      )}
    </>
  );
}
