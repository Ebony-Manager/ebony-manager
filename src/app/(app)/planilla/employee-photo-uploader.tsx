"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Camera, Trash2 } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateEmployeeAction } from "./actions";

const BUCKET = "employee-photos";
const MAX_SIDE = 512;

/** Reduce la foto a máx. 512 px y la convierte a JPEG (suele quedar en
 *  ~50 KB): el celular entrega fotos de varios MB que no hacen falta. */
async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
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
 * Botones "Agregar / Cambiar foto" y "Quitar" del perfil. Sube a un bucket
 * PRIVADO con la sesión del admin (la policy `employee_photos_admin_all`
 * lo permite solo a admins) y guarda la ruta en `photo_path`. Al subir una
 * nueva, borra la anterior. En el celular el selector ofrece la cámara.
 */
export function EmployeePhotoUploader({
  employee,
  hasPhoto,
  onPhotoChange,
}: {
  employee: PayrollEmployee;
  hasPhoto: boolean;
  onPhotoChange: (url: string | null) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();
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
      const path = `${employee.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      await updateEmployeeAction(employee.id, { photoPath: path });
      if (employee.photoPath) await supabase.storage.from(BUCKET).remove([employee.photoPath]);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      onPhotoChange(data?.signedUrl ?? null);
      toast.success(tt("photo_saved"));
      router.refresh();
    } catch (err) {
      console.error("Planilla: no se pudo guardar la foto", err);
      toast.error(tt("photo_error"));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await updateEmployeeAction(employee.id, { photoPath: null });
      if (employee.photoPath) await createClient().storage.from(BUCKET).remove([employee.photoPath]);
      onPhotoChange(null);
      toast.success(tt("photo_removed"));
      router.refresh();
    } catch (err) {
      console.error("Planilla: no se pudo quitar la foto", err);
      toast.error(tt("photo_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-7 px-2 text-xs"
      >
        <Camera className="size-3.5" />
        {busy ? tt("photo_uploading") : hasPhoto ? tt("photo_change") : tt("photo_add")}
      </Button>
      {hasPhoto && !busy && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={onRemove}
          title={tt("photo_remove")}
          aria-label={tt("photo_remove")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
