import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * URL firmada (1 h) de la foto de cada persona que tenga una, en un bucket
 * privado (`employee-photos` o `contractor-photos`). Si el bucket no existe
 * todavía (migración sin aplicar) o algo falla, devuelve {} y la app muestra
 * las iniciales como siempre.
 */
export async function signedPhotoUrls(
  bucket: string,
  people: readonly { id: string; photoPath: string | null }[]
): Promise<Record<string, string>> {
  const withPhoto = people.filter((p) => p.photoPath);
  if (withPhoto.length === 0) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(withPhoto.map((p) => p.photoPath as string), 3600);
    if (error || !data) return {};
    const byPath = new Map(data.map((d) => [d.path, d.signedUrl]));
    const out: Record<string, string> = {};
    for (const p of withPhoto) {
      const url = byPath.get(p.photoPath as string);
      if (url) out[p.id] = url;
    }
    return out;
  } catch {
    return {};
  }
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
