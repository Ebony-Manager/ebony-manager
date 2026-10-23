import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  STAFF_DOCUMENTS_BUCKET,
  documentPath,
  sniffDocumentExt,
  type StaffDocumentKind,
} from "@/lib/personal/staff-documents";

const MAX_BYTES = 10 * 1024 * 1024;

/** Por qué no se pudo copiar el documento (se muestra al usuario y queda en los logs). */
export type CopyDocumentError =
  /** No hay JOTFORM_API_KEY en el servidor. */
  | "no_key"
  /** El enlace no es un archivo de JotForm. */
  | "bad_url"
  /** JotForm contestó con un error (401/403 = la clave no tiene acceso). */
  | "http"
  /** JotForm contestó con una página (login) en vez del archivo: la clave no sirve para ese archivo. */
  | "not_document"
  | "too_big"
  | "upload"
  | "network";

export type CopyDocumentResult = { path: string } | { error: CopyDocumentError; status?: number };

/**
 * Copia a la plataforma el documento que la persona subió en JotForm: lo
 * descarga con `JOTFORM_API_KEY` (JotForm protege los archivos subidos) y lo
 * sube al bucket privado con la sesión del usuario. El tipo de archivo se
 * reconoce por sus primeros bytes (JotForm no siempre manda un content-type
 * útil). Si falla, devuelve el motivo — el enlace sigue en las notas, así
 * que no se pierde nada y se puede reintentar desde la ficha.
 */
export async function copyJotformDocument(kind: StaffDocumentKind, ownerId: string, fileUrl: string): Promise<CopyDocumentResult> {
  const fail = (error: CopyDocumentError, status?: number): CopyDocumentResult => {
    console.error("No se pudo copiar el documento de JotForm:", error, status ?? "");
    return { error, status };
  };
  const apiKey = process.env.JOTFORM_API_KEY?.trim();
  if (!apiKey) return fail("no_key");
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    return fail("bad_url");
  }
  // Solo archivos de JotForm: la URL viene del formulario, no se sigue cualquier enlace.
  if (url.protocol !== "https:" || !(url.hostname === "jotform.com" || url.hostname.endsWith(".jotform.com"))) return fail("bad_url");
  url.searchParams.set("apiKey", apiKey);

  let bytes: Uint8Array;
  let contentType: string;
  try {
    const res = await fetch(url, { headers: { APIKEY: apiKey }, cache: "no-store", redirect: "follow" });
    if (!res.ok) return fail("http", res.status);
    contentType = res.headers.get("content-type") ?? "";
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error("JotForm: error de red al bajar el documento", err);
    return fail("network");
  }
  if (bytes.byteLength > MAX_BYTES) return fail("too_big");
  // Se confía en los bytes, no en el content-type: una página de login con
  // "image/jpeg" no debe subirse como foto.
  const ext = sniffDocumentExt(bytes);
  if (!ext) {
    console.error("JotForm: no es una imagen ni PDF; content-type:", contentType, "bytes:", bytes.byteLength);
    return fail("not_document");
  }

  const path = documentPath(kind, ownerId, ext);
  const supabase = await createClient();
  const { error } = await supabase.storage.from(STAFF_DOCUMENTS_BUCKET).upload(path, bytes, {
    contentType: ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`,
  });
  if (error) {
    console.error("No se pudo subir el documento de JotForm", error);
    return fail("upload");
  }
  return { path };
}
