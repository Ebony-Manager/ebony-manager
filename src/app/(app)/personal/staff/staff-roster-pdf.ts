import type { RosterRow } from "@/lib/personal/staff-roster";

export interface RosterPdfLabels {
  company: string;
  title: string;
  generated: string;
  columns: {
    n: string;
    employee: string;
    position: string;
    type: string;
    start: string;
    document: string;
    nationality: string;
    birth: string;
    phone: string;
    bank: string;
    emergency: string;
    end: string;
    status: string;
  };
  page: string;
}

export interface RosterPdfOptions {
  /** Puesto: solo tienen los empleados. */
  showPosition: boolean;
  showBank: boolean;
  showEmergency: boolean;
  showStatus: boolean;
}

const WALNUT: [number, number, number] = [107, 87, 68];
const INK: [number, number, number] = [4, 7, 7];

/**
 * PDF horizontal (A4) con la lista del staff (empleados y/o contratistas) y
 * su ficha, para imprimir. `showPosition` / `showBank` / `showEmergency` /
 * `showStatus` activan esas columnas. La
 * librería se carga solo al descargar.
 */
export async function buildRosterPdf(
  rows: readonly RosterRow[],
  opts: RosterPdfOptions,
  labels: RosterPdfLabels
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 28;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WALNUT);
  doc.text(labels.company.toUpperCase(), margin, 34);
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(labels.title, margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(labels.generated, pageW - margin, 34, { align: "right" });

  const c = labels.columns;
  const head = [c.n, c.employee, ...(opts.showPosition ? [c.position] : []), c.type, c.start, c.document, c.nationality, c.birth, c.phone];
  if (opts.showBank) head.push(c.bank);
  if (opts.showEmergency) head.push(c.emergency);
  if (opts.showStatus) head.push(c.end, c.status);

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin, bottom: 36 },
    head: [head],
    body: rows.map((r) => {
      const line = [String(r.n), r.name, ...(opts.showPosition ? [r.position] : []), r.type, r.startDate, r.document, r.nationality, r.birthDate, r.phone];
      if (opts.showBank) line.push(r.bank);
      if (opts.showEmergency) line.push(r.emergency);
      if (opts.showStatus) line.push(r.endDate, r.status);
      return line;
    }),
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3, textColor: INK, lineColor: [225, 225, 222], lineWidth: 0.4, overflow: "linebreak" },
    headStyles: { fillColor: WALNUT, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: { 0: { halign: "right", cellWidth: 20, textColor: [130, 130, 130] }, 1: { fontStyle: "bold" } },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${labels.page} ${p} / ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }
  return doc;
}

export async function downloadRosterPdf(
  rows: readonly RosterRow[],
  opts: RosterPdfOptions,
  labels: RosterPdfLabels,
  fileName: string
) {
  const doc = await buildRosterPdf(rows, opts, labels);
  doc.save(fileName);
}
