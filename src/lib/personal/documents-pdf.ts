import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/**
 * Un solo PDF con los documentos (cédula / pasaporte) de varias personas —
 * para mandarlos a un edificio o comercio antes de una instalación. Se arma
 * en el navegador con las URLs firmadas de cada documento.
 *
 *  · Fotos: dos por hoja carta, cada una con el nombre y el número arriba.
 *  · Documentos que ya son PDF: se agregan sus páginas tal cual, con el
 *    nombre escrito arriba de la primera.
 */
export interface DocumentForPdf {
  name: string;
  /** "Cédula 8-123-456" — lo que va debajo del nombre. */
  label: string;
  url: string;
  isPdf: boolean;
}

const PAGE_W = 612; // carta, en puntos
const PAGE_H = 792;
const MARGIN = 36;
const SLOT_GAP = 24;
const HEADER_H = 34;

export async function buildDocumentsPdf(items: readonly DocumentForPdf[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const slotH = (PAGE_H - 2 * MARGIN - SLOT_GAP) / 2;
  let page: PDFPage | null = null;
  let slot = 0;

  for (const item of items) {
    const bytes = await (await fetch(item.url)).arrayBuffer();
    if (item.isPdf) {
      const src = await PDFDocument.load(bytes);
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((p, i) => {
        doc.addPage(p);
        if (i === 0) drawHeader(p, item, MARGIN, p.getHeight() - MARGIN / 2 - 10, bold, regular);
      });
      page = null; // lo que sigue arranca hoja nueva
      continue;
    }

    const image = await embedImage(doc, bytes);
    if (!page || slot === 2) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      slot = 0;
    }
    const top = PAGE_H - MARGIN - slot * (slotH + SLOT_GAP);
    drawHeader(page, item, MARGIN, top - 12, bold, regular);
    const boxW = PAGE_W - 2 * MARGIN;
    const boxH = slotH - HEADER_H;
    const scale = Math.min(boxW / image.width, boxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: MARGIN + (boxW - w) / 2, y: top - HEADER_H - h, width: w, height: h });
    slot += 1;
  }

  return doc.save();
}

function drawHeader(page: PDFPage, item: DocumentForPdf, x: number, y: number, bold: PDFFont, regular: PDFFont) {
  page.drawText(safe(item.name, bold), { x, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
  if (item.label) page.drawText(safe(item.label, regular), { x, y: y - 14, size: 9.5, font: regular, color: rgb(0.4, 0.4, 0.4) });
}

/** Las fuentes estándar no tienen todos los caracteres: lo que no se pueda escribir se cambia por "?". */
function safe(text: string, font: PDFFont): string {
  return [...text].map((ch) => {
    try {
      font.encodeText(ch);
      return ch;
    } catch {
      return "?";
    }
  }).join("");
}

/** JPG y PNG van directo; cualquier otro formato que el navegador lea se pasa a JPG. */
async function embedImage(doc: PDFDocument, bytes: ArrayBuffer): Promise<PDFImage> {
  const head = new Uint8Array(bytes.slice(0, 4));
  if (head[0] === 0xff && head[1] === 0xd8) return doc.embedJpg(bytes);
  if (head[0] === 0x89 && head[1] === 0x50) return doc.embedPng(bytes);
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  const jpg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo leer la imagen"))), "image/jpeg", 0.9)
  );
  return doc.embedJpg(await jpg.arrayBuffer());
}
