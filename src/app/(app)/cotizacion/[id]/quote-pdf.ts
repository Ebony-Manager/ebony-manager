import type { jsPDF as JsPDF } from "jspdf";

import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/components/brand/ebony-logo";
import { formatMoney, lineAmount, lineQty, quoteTotals, sectionLabel, sectionTotals } from "@/lib/cotizador/pricing";
import { groupedOrder } from "@/lib/cotizador/items";
import { quoteWho, validUntil } from "@/lib/cotizador/owner";
import { TERMS, TERMS_INTRO, TERMS_TITLE, richSegments } from "@/lib/cotizador/terms";
import { strings, t } from "@/lib/i18n";
import type { Quote, QuoteImage } from "@/types/cotizador";
import { photoUrl } from "@/lib/photo-url";
import { UNIT_LABEL } from "./line-row";

// PDF de la cotización para el cliente: lo mismo que "Vista para el cliente"
// (encabezado de Ebony, para quién, ítems con el detalle elegido, totales,
// notas y forma de pago) y, en hojas aparte, las Condiciones Generales. Se
// arma en el navegador; la librería se carga solo al pedirlo.

const INK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [110, 110, 110];
const RULE: [number, number, number] = [225, 225, 222];

/** El logo (vector) como PNG nítido para el PDF. */
function logoPng(heightPt: number): { data: string; w: number; h: number } | null {
  if (typeof document === "undefined") return null;
  const [vx, vy, vw, vh] = WORDMARK_VIEWBOX.split(" ").map(Number);
  const scale = 4;
  const hPx = Math.round(heightPt * scale);
  const wPx = Math.round((vw / vh) * hPx);
  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(wPx / vw, hPx / vh);
  ctx.translate(-vx, -vy);
  ctx.fillStyle = "#141414";
  ctx.fill(new Path2D(WORDMARK_PATH));
  return { data: canvas.toDataURL("image/png"), w: (vw / vh) * heightPt, h: heightPt };
}

/** Texto con partes en negrita (`**así**`), en renglones de ancho `width`. Devuelve la y final. */
function richText(doc: JsPDF, text: string, x: number, y: number, width: number, lineH: number, fit: (y: number, h: number) => number): number {
  const words: { w: string; bold: boolean }[] = [];
  for (const seg of richSegments(text)) {
    for (const piece of seg.text.split(/(\s+)/)) if (piece) words.push({ w: piece, bold: seg.bold });
  }
  const lines: { w: string; bold: boolean }[][] = [[]];
  let lineW = 0;
  for (const word of words) {
    doc.setFont("helvetica", word.bold ? "bold" : "normal");
    const ww = doc.getTextWidth(word.w);
    const isSpace = !word.w.trim();
    if (!isSpace && lineW + ww > width && lines[lines.length - 1].length > 0) {
      lines.push([]);
      lineW = 0;
    }
    if (isSpace && lines[lines.length - 1].length === 0) continue;
    lines[lines.length - 1].push(word);
    lineW += ww;
  }
  for (const line of lines) {
    y = fit(y, lineH);
    let cx = x;
    for (const word of line) {
      doc.setFont("helvetica", word.bold ? "bold" : "normal");
      doc.text(word.w, cx, y);
      cx += doc.getTextWidth(word.w);
    }
    y += lineH;
  }
  return y;
}

/** La primera imagen de cada ítem, lista para el PDF (JPEG ~600 px). */
async function loadItemImages(images: readonly QuoteImage[]): Promise<Map<string, { data: string; w: number; h: number }>> {
  const first = new Map<string, QuoteImage>();
  for (const im of [...images].sort((a, b) => a.sortOrder - b.sortOrder)) if (!first.has(im.sectionId)) first.set(im.sectionId, im);
  const out = new Map<string, { data: string; w: number; h: number }>();
  await Promise.all(
    [...first.values()].map(async (im) => {
      try {
        const res = await fetch(photoUrl("quote-images", im.path, 600));
        if (!res.ok) return;
        const bitmap = await createImageBitmap(await res.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        out.set(im.sectionId, { data: canvas.toDataURL("image/jpeg", 0.85), w: bitmap.width, h: bitmap.height });
        bitmap.close();
      } catch {
        // Sin la imagen, el ítem sale igual.
      }
    })
  );
  return out;
}

export async function buildQuotePdf(quote: Quote, images: readonly QuoteImage[] = []): Promise<JsPDF> {
  const [{ jsPDF }, { default: autoTable }, itemImages] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadItemImages(images)]);
  const tq = (k: keyof typeof strings.cotizador) => t(quote.lang, strings.cotizador[k]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 44;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const bottom = pageH - 48;
  const logo = logoPng(26);
  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(quote.lang === "en" ? "en-US" : "es-PA", { day: "2-digit", month: "2-digit", year: "numeric" });

  // ── Encabezado de Ebony ──
  if (logo) doc.addImage(logo.data, "PNG", margin, 40, logo.w, logo.h);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("custom woodwork", margin, 80, { charSpace: 1.5 });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("EBONY DESIGNS, S.A.", pageW - margin, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  ["RUC 155678857-2-2019 DV: 0", "6329-6666 · ventas@ebonypanama.com", "Ave 1A Sur - San Francisco"].forEach((l, i) =>
    doc.text(l, pageW - margin, 58 + i * 11, { align: "right" })
  );
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(margin, 98, pageW - margin, 98);

  // ── Para quién y datos de la cotización ──
  let y = 122;
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(tq("cv_quote").toUpperCase(), margin, y, { charSpace: 0.8 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  const who = doc.splitTextToSize(quoteWho(quote) || "—", contentW * 0.55) as string[];
  doc.text(who, margin, y + 20);
  let ly = y + 20 + (who.length - 1) * 18 + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (quote.projectName) {
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(quote.projectName, contentW * 0.55) as string[], margin, ly);
    ly += 14;
  }
  if (quote.clientName && quote.designerName) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(quote.designerName, margin, ly);
    ly += 13;
  }
  const meta: [string, string][] = [
    [tq("cv_number"), quote.number || "—"],
    [tq("f_date"), fmtDate(quote.quoteDate)],
    [tq("valid_until"), fmtDate(validUntil(quote.quoteDate, quote.validDays))],
    [tq("cv_delivery"), `${quote.deliveryDays} ${tq("cv_business_days")}`],
  ];
  doc.setFontSize(9);
  meta.forEach(([k, v], i) => {
    const my = y + 4 + i * 13;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(k, pageW - margin - 110, my, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(v, pageW - margin, my, { align: "right" });
  });
  y = Math.max(ly, y + 4 + meta.length * 13) + 12;

  // ── Ítems ──
  const detail = quote.pdfDetail;
  const hasQty = quote.sections.some((s) => s.qty > 1);
  const showQty = detail === "line" || hasQty;
  const showUnit = detail === "section" && hasQty;
  // Con imágenes, una columna a la izquierda con la del ítem (ocupa todas sus filas).
  const withImages = quote.sections.some((sec) => itemImages.has(sec.id));
  const IMG_W = 72;
  const head = [
    ...(withImages ? [""] : []),
    tq("cv_item"),
    ...(showQty ? [tq("cv_qty")] : []),
    ...(showUnit ? [tq("cv_unit_price")] : []),
    ...(detail !== "total" ? [tq("total")] : []),
  ];
  const cols = head.length;
  const first = withImages ? 1 : 0;
  type Row = { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> }[];
  const body: Row[] = [];
  const rowImage = new Map<number, { data: string; w: number; h: number }>();
  const itemEnds = new Set<number>();
  const sub = { fontSize: 8, textColor: MUTED, cellPadding: { top: 1.5, bottom: 1.5, left: 6, right: 6 } };
  for (const s of groupedOrder(quote.sections)) {
    const st = sectionTotals(s);
    const title = `${s.kind} · ${sectionLabel(s) || tq("sec_unnamed")}`;
    const desc = s.description.trim();
    const rows = 1 + (desc ? 1 : 0) + (detail === "line" ? s.lines.length : 0);
    const img = itemImages.get(s.id);
    if (img) rowImage.set(body.length, img);
    body.push([
      ...(withImages ? [{ content: "", rowSpan: rows, styles: { cellWidth: IMG_W } }] : []),
      { content: title, styles: { fontStyle: "bold" } },
      ...(showQty ? [{ content: detail === "line" ? (st.qty > 1 ? `× ${st.qty}` : "") : String(st.qty) }] : []),
      ...(showUnit ? [{ content: formatMoney(st.unit) }] : []),
      ...(detail !== "total" ? [{ content: formatMoney(st.total), styles: { fontStyle: "bold" } }] : []),
    ]);
    if (desc) {
      body.push([{ content: desc, colSpan: cols - first, styles: { fontSize: 8, textColor: MUTED, cellPadding: { top: 0, bottom: 6, left: 6, right: 6 } } }]);
    }
    if (detail === "line") {
      const cost = st.ebony + st.sub;
      const factor = cost > 0 ? (st.unit / cost) * st.qty : 0;
      for (const l of s.lines) {
        body.push([
          { content: `   ${l.name}`, styles: { ...sub } },
          { content: `${(lineQty(l) * st.qty).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${UNIT_LABEL[l.unit]}`, styles: { ...sub } },
          { content: formatMoney(lineAmount(l) * factor), styles: { ...sub } },
        ]);
      }
    }
    // Con imagen, la última fila del ítem completa la altura (así el título
    // y la descripción quedan juntos, al lado de la imagen).
    if (img) {
      const last = body[body.length - 1];
      const cell = last[last === body[body.length - rows] && withImages ? 1 : 0];
      cell.styles = { ...cell.styles, minCellHeight: Math.max(0, 70 - 20 * (rows - 1)) };
    }
    itemEnds.add(body.length - 1);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 56, top: 44 },
    head: [head],
    body: body as never,
    theme: "plain",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, textColor: INK, valign: "top" },
    headStyles: { fontSize: 7.5, textColor: MUTED, fontStyle: "bold", lineWidth: { bottom: 0.6 }, lineColor: RULE },
    columnStyles: Object.fromEntries(
      head.map((_, i) => [i, i === 0 && withImages ? { cellWidth: IMG_W } : i === first ? {} : { halign: "right", cellWidth: i === cols - 1 ? 80 : 64 }])
    ),
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index > first) d.cell.styles.halign = "right";
    },
    didDrawCell: (d) => {
      if (d.section !== "body") return;
      // La imagen del ítem, ajustada a su celda.
      if (withImages && d.column.index === 0) {
        const img = rowImage.get(d.row.index);
        if (img) {
          const maxW = IMG_W - 10;
          const maxH = Math.max(40, Math.min(d.cell.height - 10, 90));
          const k = Math.min(maxW / img.w, maxH / img.h);
          d.doc.addImage(img.data, "JPEG", d.cell.x + 4, d.cell.y + 6, img.w * k, img.h * k);
        }
        return;
      }
      // Una raya entre ítems (después de la descripción o del último renglón).
      if (d.column.index !== first || !itemEnds.has(d.row.index)) return;
      d.doc.setDrawColor(...RULE);
      d.doc.setLineWidth(0.4);
      d.doc.line(margin, d.cell.y + d.cell.height, pageW - margin, d.cell.y + d.cell.height);
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = 56;
    }
    return y;
  };

  // ── Totales ──
  const totals = quoteTotals(quote);
  const rows: [string, string, boolean][] = [[tq("subtotal"), formatMoney(totals.subtotal), false]];
  if (totals.discount > 0) rows.push([tq("discount"), `-${formatMoney(totals.discount)}`, false]);
  rows.push([`ITBMS (${quote.itbmsPct}%)`, formatMoney(totals.tax), false]);
  rows.push([tq("total"), formatMoney(totals.total), true]);
  ensure(rows.length * 16 + 10);
  const tx = pageW - margin - 200;
  rows.forEach(([k, v, strong], i) => {
    if (strong) {
      doc.setDrawColor(...RULE);
      doc.line(tx, y - 10, pageW - margin, y - 10);
    }
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(strong ? 11.5 : 9.5);
    doc.setTextColor(...(strong ? INK : MUTED));
    doc.text(k, tx, y);
    doc.setTextColor(...INK);
    doc.text(v, pageW - margin, y, { align: "right" });
    y += strong ? 18 : 15;
    if (i === rows.length - 2) y += 4;
  });

  // ── Notas, cuenta y pago ──
  doc.setFontSize(9);
  if (quote.notes.trim()) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    for (const line of doc.splitTextToSize(quote.notes.trim(), contentW) as string[]) {
      ensure(12);
      doc.text(line, margin, y);
      y += 12;
    }
  }
  y += 12;
  ensure(40);
  doc.setDrawColor(...RULE);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  for (const line of [
    "Ebony Designs SA · Banco General – Corriente 03-70-01-127629-2",
    ...(doc.splitTextToSize(tq("cv_payment"), contentW) as string[]),
    ...(doc.splitTextToSize(tq("cv_terms_note"), contentW) as string[]),
  ]) {
    ensure(11);
    doc.text(line, margin, y);
    y += 11;
  }

  // ── Condiciones generales (hojas aparte) ──
  doc.addPage();
  y = 46;
  if (logo) doc.addImage(logo.data, "PNG", pageW - margin - logo.w * 0.8, 36, logo.w * 0.8, logo.h * 0.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(TERMS_TITLE, margin, y);
  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  for (const line of doc.splitTextToSize(TERMS_INTRO, contentW) as string[]) {
    doc.text(line, margin, y);
    y += 10;
  }
  const bullet = (text: string, indent: number, mark: string) => {
    ensure(10);
    doc.setFont("helvetica", "normal");
    doc.text(mark, margin + indent, y);
    y = richText(doc, text, margin + indent + 10, y, contentW - indent - 10, 10, (cy, h) => {
      if (cy + h <= bottom) return cy;
      doc.addPage();
      return 56;
    });
  };
  for (const section of TERMS) {
    y += 5;
    ensure(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(section.title, margin, y);
    y += 12;
    doc.setFontSize(8);
    for (const item of section.items) {
      if (typeof item === "string") bullet(item, 6, "•");
      else {
        bullet(item.text, 6, "•");
        for (const subItem of item.sub) bullet(subItem, 22, "–");
      }
      y += 1;
    }
  }

  // Numeración de páginas.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`${quote.number || ""}`, margin, pageH - 24);
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 24, { align: "right" });
  }
  return doc;
}

/** "COT-2640 Teo Zebede.pdf" (sin caracteres raros). */
export function quotePdfName(quote: Quote): string {
  const who = (quoteWho(quote) || quote.projectName || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ._-]+/g, "")
    .trim()
    .slice(0, 50);
  return `${[quote.number || "Cotizacion", who].filter(Boolean).join(" ")}.pdf`;
}

/** Arma el PDF y lo descarga (o lo comparte, en celular). */
export async function downloadQuotePdf(quote: Quote, images: readonly QuoteImage[] = []): Promise<void> {
  const doc = await buildQuotePdf(quote, images);
  const name = quotePdfName(quote);
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
