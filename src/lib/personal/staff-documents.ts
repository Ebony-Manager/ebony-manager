/**
 * Documento (cédula / pasaporte) del staff en el bucket privado
 * `staff-documents`: `employees/<id>/...` o `contractors/<id>/...` (la RLS
 * de storage pide Planilla o Contratistas según la carpeta).
 */

export const STAFF_DOCUMENTS_BUCKET = "staff-documents";

export type StaffDocumentKind = "employee" | "contractor";

export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function documentFolder(kind: StaffDocumentKind): "employees" | "contractors" {
  return kind === "employee" ? "employees" : "contractors";
}

export type DocumentExt = "jpg" | "png" | "webp" | "pdf";

/** Tipo de archivo aceptado → extensión; null si no se acepta. */
export function documentExt(contentType: string): DocumentExt | null {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return null;
}

/**
 * Tipo de archivo por sus primeros bytes (JPEG, PNG, WebP o PDF), para no
 * depender del content-type que mande el servidor (a veces es genérico, ej.
 * "application/octet-stream"). null si no es ninguno — p. ej. una página HTML.
 */
export function sniffDocumentExt(bytes: Uint8Array): DocumentExt | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "pdf";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Ruta nueva para el documento de una persona (con fecha, para no pisar el anterior en caché). */
export function documentPath(kind: StaffDocumentKind, ownerId: string, ext: DocumentExt, now = Date.now()): string {
  return `${documentFolder(kind)}/${ownerId}/${now}.${ext}`;
}

export function isPdfPath(path: string | null): boolean {
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

