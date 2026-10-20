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

/** Ruta nueva para el documento de una persona (con fecha, para no pisar el anterior en caché). */
export function documentPath(kind: StaffDocumentKind, ownerId: string, ext: DocumentExt, now = Date.now()): string {
  return `${documentFolder(kind)}/${ownerId}/${now}.${ext}`;
}

export function isPdfPath(path: string | null): boolean {
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

