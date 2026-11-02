import "server-only";

import { createClient } from "@/lib/supabase/server";
import { THUMB_WIDTH, photoUrl, type PhotoBucket } from "@/lib/photo-url";

/**
 * Dirección fija (en miniatura) de la foto de cada persona que tenga una, en
 * un bucket privado (`employee-photos` o `contractor-photos`). La dirección no
 * cambia, así el navegador guarda la foto y no la vuelve a pedir a Supabase
 * (ver src/lib/photo-url.ts). Sin foto, la app muestra las iniciales.
 */
export async function signedPhotoUrls(
  bucket: PhotoBucket,
  people: readonly { id: string; photoPath: string | null }[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of people) if (p.photoPath) out[p.id] = photoUrl(bucket, p.photoPath, THUMB_WIDTH);
  return out;
}

/** URL firmada (1 h) de un documento del bucket privado staff-documents; null si no hay o falla. */
export async function signedDocumentUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("staff-documents").createSignedUrl(path, 3600);
  if (error) {
    console.error("No se pudo firmar el documento", error);
    return null;
  }
  return data.signedUrl;
}
