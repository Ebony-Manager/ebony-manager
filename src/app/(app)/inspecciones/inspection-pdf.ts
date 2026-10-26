import type { InspectionItem } from "@/types/inspections";

// PDF de una inspección para el instalador: cada detalle con su número,
// área, estado, comentario y fotos. Por visita (un título por visita) o todo
// junto (una sola lista). La librería se carga solo al armarlo.

export interface InspectionPdfGroup {
  /** "Visita 12-Oct-26" o "Todos los detalles". */
  title: string;
  items: (InspectionItem & { visitLabel?: string })[];
}

export interface InspectionPdfLabels {
  company: string;
  title: string;
  project: string;
  /** Cliente · ubicación. */
  subtitle: string;
  generated: string;
  summary: string;
  page: string;
  noArea: string;
  noComment: string;
  pending: string;
  resolved: string;
  after: string;
  photoMissing: string;
}

const WALNUT: [number, number, number] = [107, 87, 68];
const INK: [number, number, number] = [4, 7, 7];
const MUTED: [number, number, number] = [110, 110, 110];
const AMBER: [number, number, number] = [180, 110, 20];
const GREEN: [number, number, number] = [40, 130, 80];

interface LoadedPhoto {
  data: string;
  w: number;
  h: number;
  after: boolean;
}

// Fotos ya preparadas (por URL): cambiar las opciones del PDF no las vuelve a bajar.
const photoCache = new Map<string, Promise<{ data: string; w: number; h: number } | null>>();

/** Baja la foto (URL firmada) y la deja como JPEG de máx. 1200 px para el PDF. */
function loadPhoto(url: string): Promise<{ data: string; w: number; h: number } | null> {
  let p = photoCache.get(url);
  if (!p) {
    p = fetchPhoto(url);
    photoCache.set(url, p);
  }
  return p;
}

async function fetchPhoto(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return { data: canvas.toDataURL("image/jpeg", 0.8), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

export async function buildInspectionPdf(groups: readonly InspectionPdfGroup[], labels: InspectionPdfLabels) {
  const { jsPDF } = await import("jspdf");

  // Fotos primero (en paralelo), para medir cada detalle antes de dibujarlo.
  const allPhotos = groups.flatMap((g) => g.items.flatMap((i) => i.photos));
  const loaded = new Map<string, LoadedPhoto | null>();
  await Promise.all(
    allPhotos.map(async (p) => {
      const img = p.url ? await loadPhoto(p.url) : null;
      loaded.set(p.id, img ? { ...img, after: p.kind === "despues" } : null);
    }),
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const bottom = pageH - 40;
  const gap = 8;
  const perRow = 3;
  const photoW = (contentW - 22 - gap * (perRow - 1)) / perRow;
  const maxPhotoH = 190;
  let y = 0;

  // Encabezado (solo en la primera página).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WALNUT);
  doc.text(labels.company.toUpperCase(), margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(labels.generated, pageW - margin, 40, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(labels.title, margin, 62);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(labels.project, contentW) as string[], margin, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  y = 80 + 14;
  if (labels.subtitle) {
    doc.text(labels.subtitle, margin, y);
    y += 13;
  }
  doc.text(labels.summary, margin, y);
  y += 10;
  doc.setDrawColor(...WALNUT);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  const newPage = () => {
    doc.addPage();
    y = 44;
  };
  const ensure = (h: number) => {
    if (y + h > bottom) newPage();
  };

  // Alto de una fila de fotos (la más alta, con tope).
  const rowHeight = (row: (LoadedPhoto | null)[]) =>
    Math.max(...row.map((p) => (p ? Math.min(maxPhotoH, (photoW * p.h) / p.w) : 40)));

  // Lo que ocupa un detalle: líneas del comentario, filas de fotos y el alto
  // mínimo para no dejar su encabezado solo al pie de una página.
  const prep = (item: InspectionPdfGroup["items"][number]) => {
    doc.setFontSize(10);
    const commentLines = doc.splitTextToSize(item.comment.trim() || labels.noComment, contentW - 22) as string[];
    const photos = item.photos.map((p) => loaded.get(p.id) ?? null);
    const rows: (LoadedPhoto | null)[][] = [];
    for (let i = 0; i < photos.length; i += perRow) rows.push(photos.slice(i, i + perRow));
    const textH = 16 + commentLines.length * 12.5 + (item.visitLabel ? 11 : 0);
    return { commentLines, rows, minH: textH + (rows[0] ? rowHeight(rows[0]) + 8 : 0) };
  };

  let n = 0;
  for (const group of groups) {
    if (groups.length > 1 || group.title) {
      // El título de la visita va con (al menos) su primer detalle.
      ensure(22 + (group.items[0] ? prep(group.items[0]).minH : 0));
      doc.setFillColor(245, 241, 236);
      doc.rect(margin, y - 12, contentW, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...WALNUT);
      doc.text(group.title, margin + 6, y + 2);
      y += 22;
    }

    for (const item of group.items) {
      n += 1;
      const { commentLines, rows, minH } = prep(item);
      // Encabezado + comentario + la primera fila de fotos juntos en la misma página.
      ensure(minH);

      // Número, área y estado.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(`${n}.`, margin, y);
      const area = item.area?.trim() || labels.noArea;
      doc.text(area, margin + 22, y);
      const resolved = item.status === "resuelto";
      doc.setFontSize(8.5);
      doc.setTextColor(...(resolved ? GREEN : AMBER));
      doc.text((resolved ? labels.resolved : labels.pending).toUpperCase(), pageW - margin, y, { align: "right" });
      y += 14;
      if (item.visitLabel) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(item.visitLabel, margin + 22, y - 2);
        y += 9;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      for (const line of commentLines) {
        ensure(13);
        doc.text(line, margin + 22, y);
        y += 12.5;
      }
      y += 4;

      for (const row of rows) {
        const h = rowHeight(row);
        ensure(h + 8);
        row.forEach((p, i) => {
          const x = margin + 22 + i * (photoW + gap);
          if (!p) {
            doc.setDrawColor(220, 220, 220);
            doc.rect(x, y, photoW, 40);
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(labels.photoMissing, x + photoW / 2, y + 23, { align: "center" });
            return;
          }
          // Cabe en photoW × h sin deformarse.
          const scale = Math.min(photoW / p.w, h / p.h);
          const w = p.w * scale;
          const ph = p.h * scale;
          doc.addImage(p.data, "JPEG", x, y, w, ph);
          if (p.after) {
            doc.setFillColor(...GREEN);
            doc.rect(x, y, 46, 13, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text(labels.after.toUpperCase(), x + 23, y + 9, { align: "center" });
            doc.setFont("helvetica", "normal");
          }
        });
        y += h + gap;
      }

      // Separador entre detalles.
      y += 4;
      doc.setDrawColor(230, 228, 224);
      doc.setLineWidth(0.5);
      if (y < bottom) doc.line(margin, y, pageW - margin, y);
      y += 16;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(labels.project, margin, pageH - 20);
    doc.text(`${labels.page} ${p} / ${pages}`, pageW - margin, pageH - 20, { align: "right" });
  }
  return doc;
}

/** Comparte el PDF (celular: WhatsApp, correo…) o, si no se puede, lo descarga. */
export async function shareOrDownloadPdf(blob: Blob, fileName: string, shareText: string, share: boolean): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (share && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName, text: shareText });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

/** "inspeccion-casa-perez-2026-10-26.pdf" */
export function inspectionPdfName(project: string, date: string): string {
  const slug = project
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `inspeccion-${slug || "proyecto"}-${date}.pdf`;
}

/** Puede el navegador compartir archivos (celular)? */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}
