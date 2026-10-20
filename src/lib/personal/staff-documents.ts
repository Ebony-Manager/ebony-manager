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

/** Un archivo elegido para importar (lo que importa del `File` del navegador). */
export interface ImportFile {
  /** Ruta relativa al elegir una carpeta ("Vigente/Javier Alonzo/123.jpg") o solo el nombre. */
  path: string;
  size: number;
}

export interface ImportGroup<F extends ImportFile> {
  /** Nombre de la persona: la subcarpeta, o el nombre del archivo sin extensión. */
  name: string;
  /** El archivo a cargar: la foto más grande (no la firma); si no hay foto, el PDF. */
  file: F | null;
}

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const PDF_RE = /\.pdf$/i;

/**
 * Agrupa los archivos por persona. Pensado para la carpeta "Vigente" de
 * Drive (una subcarpeta por persona con la foto del documento, el PDF del
 * registro y a veces la firma), pero también acepta archivos sueltos
 * nombrados como la persona ("Jose Salcedo.jpg").
 */
export function groupImportFiles<F extends ImportFile>(files: readonly F[]): ImportGroup<F>[] {
  const groups = new Map<string, F[]>();
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1] ?? "";
    if (fileName.startsWith(".")) continue;
    const name = parts.length >= 2 ? parts[parts.length - 2] : fileName.replace(/\.[^.]+$/, "");
    groups.set(name, [...(groups.get(name) ?? []), f]);
  }
  const bySize = (a: F, b: F) => b.size - a.size;
  return [...groups.entries()].map(([name, list]) => {
    const images = list.filter((f) => IMAGE_RE.test(f.path) && !/signature|firma/i.test(f.path)).sort(bySize);
    const pdfs = list.filter((f) => PDF_RE.test(f.path)).sort(bySize);
    return { name: name.replace(/\s+/g, " ").trim(), file: images[0] ?? pdfs[0] ?? null };
  });
}
