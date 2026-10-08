import type { QuincenaReport } from "@/lib/planilla/quincena-report";
import { formatCents } from "@/lib/planilla/payroll-period";

export interface QuincenaPdfLabels {
  company: string;
  title: string;
  generated: string;
  columns: {
    n: string;
    employee: string;
    base: string;
    bonus: string;
    deductions: string;
    benefits: string;
    loan: string;
    net: string;
    method: string;
    paid: string;
  };
  total: string;
  byMethodTitle: string;
  methodCount: string;
  methodNet: string;
  methodName: (method: string) => string;
  yes: string;
  page: string;
}

const WALNUT: [number, number, number] = [107, 87, 68];
const INK: [number, number, number] = [4, 7, 7];
const SOFT: [number, number, number] = [243, 243, 242];

/**
 * Dibuja el resumen de la quincena en un PDF horizontal (A4). La librería
 * se carga al llamar, no pesa en el resto de la app.
 */
export async function buildQuincenaPdf(report: QuincenaReport, labels: QuincenaPdfLabels) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WALNUT);
  doc.text(labels.company.toUpperCase(), margin, 38);
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(labels.title, margin, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(labels.generated, pageW - margin, 38, { align: "right" });

  const c = labels.columns;
  const money = (cents: number) => (cents === 0 ? "–" : formatCents(cents));
  const right = { halign: "right" as const };

  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin, bottom: 40 },
    head: [[c.n, c.employee, c.base, c.bonus, c.deductions, c.benefits, c.loan, c.net, c.method, c.paid]],
    body: report.lines.map((l, i) => [
      String(i + 1),
      l.name,
      money(l.baseCents),
      money(l.bonificacionesCents),
      money(l.descuentosCents === 0 ? 0 : -l.descuentosCents),
      money(l.prestacionesCents),
      money(l.loanPaymentCents === 0 ? 0 : -l.loanPaymentCents),
      formatCents(l.netCents),
      labels.methodName(l.paymentMethod),
      l.paid ? labels.yes : "–",
    ]),
    foot: [
      [
        "",
        labels.total,
        formatCents(report.totals.baseCents),
        formatCents(report.totals.bonificacionesCents),
        formatCents(-report.totals.descuentosCents),
        formatCents(report.totals.prestacionesCents),
        formatCents(-report.totals.loanPaymentCents),
        formatCents(report.totals.netCents),
        "",
        `${report.paidCount}/${report.lines.length}`,
      ],
    ],
    showFoot: "lastPage",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [225, 225, 222], lineWidth: 0.4 },
    headStyles: { fillColor: WALNUT, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: {
      0: { halign: "right", cellWidth: 24, textColor: [130, 130, 130] },
      2: right,
      3: right,
      4: right,
      5: right,
      6: right,
      7: { ...right, fontStyle: "bold" },
      9: { halign: "center", cellWidth: 40 },
    },
    didParseCell: (d) => {
      if (d.section !== "body" && d.section !== "foot") return;
      if (d.column.index >= 2 && d.column.index <= 7) d.cell.styles.halign = "right";
    },
  });

  // Desglose por método de pago, debajo de la tabla.
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 72;
  autoTable(doc, {
    startY: lastY + 18,
    margin: { left: margin, right: pageW / 2 + 40, bottom: 40 },
    head: [[labels.byMethodTitle, labels.methodCount, labels.methodNet]],
    body: report.byMethod.map((m) => [labels.methodName(m.method), String(m.count), formatCents(m.netCents)]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [225, 225, 222], lineWidth: 0.4 },
    headStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: (d) => {
      if (d.column.index >= 1) d.cell.styles.halign = "right";
    },
  });

  // Numeración de páginas.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${labels.page} ${p} / ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  return doc;
}

/** Arma el PDF y lo descarga en el navegador. */
export async function downloadQuincenaPdf(report: QuincenaReport, labels: QuincenaPdfLabels, fileName: string) {
  const doc = await buildQuincenaPdf(report, labels);
  doc.save(fileName);
}
