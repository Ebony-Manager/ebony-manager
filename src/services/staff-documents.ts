import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  STAFF_DOCUMENTS_BUCKET,
  documentExt,
  documentPath,
  type StaffDocumentKind,
} from "@/lib/personal/staff-documents";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copia a la plataforma el documento que la persona subió en JotForm: lo
 * descarga con `JOTFORM_API_KEY` (JotForm protege los archivos subidos) y lo
 * sube al bucket privado con la sesión del usuario. Devuelve la ruta nueva,
 * o null si no hay API key, el enlace no es de JotForm o algo falla — el
 * enlace sigue en la bandeja y en las notas, así que no se pierde nada.
 */
export async function copyJotformDocument(kind: StaffDocumentKind, ownerId: string, fileUrl: string): Promise<string | null> {
  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) return null;
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    return null;
  }
  // Solo archivos de JotForm: la URL viene del formulario, no se sigue cualquier enlace.
  if (url.protocol !== "https:" || !(url.hostname === "jotform.com" || url.hostname.endsWith(".jotform.com"))) return null;
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url, { headers: { APIKEY: apiKey }, cache: "no-store" });
    if (!res.ok) return null;
    const ext = documentExt(res.headers.get("content-type") ?? "");
    if (!ext) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const path = documentPath(kind, ownerId, ext);
    const supabase = await createClient();
    const { error } = await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).upload(path, bytes, {
      contentType: ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`,
    });
    if (error) {
      console.error("No se pudo subir el documento de JotForm", error);
      return null;
    }
    return path;
  } catch (err) {
    console.error("No se pudo copiar el documento de JotForm", err);
    return null;
  }
}
