import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Ebony brand colors (RGB)
const COLORS = {
  dark:   [44,  26,  14],   // #2C1A0E
  medium: [92,  58,  30],   // #5C3A1E
  gold:   [201, 168, 76],   // #C9A84C
  warm:   [250, 247, 242],  // #FAF7F2
  gray:   [232, 226, 217],  // #E8E2D9
  white:  [255, 255, 255],
}

function fmtMoney(val) {
  return `$${Number(val || 0).toFixed(2)}`
}

/**
 * Generate and download a branded PDF quote.
 */
export function exportQuotePdf({
  id,
  cliente,
  disenadora,
  fecha,
  validDays,
  margin,
  discount,
  items,
  subtotal,
  finalTotal,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Header banner ────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, W, 38, 'F')

  // Logo placeholder (circle)
  doc.setFillColor(...COLORS.gold)
  doc.circle(18, 19, 10, 'F')
  doc.setTextColor(...COLORS.dark)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('EBONY', 18, 18.5, { align: 'center' })
  doc.text('CW', 18, 22, { align: 'center' })

  // Company name
  doc.setTextColor(...COLORS.gold)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Ebony Custom Woodwork', 34, 18)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.warm)
  doc.text('Muebles a la medida — Panamá', 34, 25)

  // Quote ID top right
  doc.setTextColor(...COLORS.gold)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('COTIZACIÓN', W - 15, 15, { align: 'right' })
  doc.setFontSize(11)
  doc.text(id || 'COT-???', W - 15, 22, { align: 'right' })

  // ── Quote meta ──────────────────────────────────────────────────────────
  let y = 46
  doc.setFillColor(...COLORS.warm)
  doc.rect(10, y - 3, W - 20, 28, 'F')

  doc.setTextColor(...COLORS.medium)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  const metaItems = [
    ['Cliente',     cliente || '—'],
    ['Diseñadora',  disenadora || '—'],
    ['Fecha',       fecha],
    ['Validez',     `${validDays} días`],
    ['Margen',      `${margin}%`],
  ]

  metaItems.forEach(([label, value], i) => {
    const col = i < 3 ? 15 : (W / 2) + 5
    const row = i < 3 ? y + (i * 7) : y + ((i - 3) * 7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.medium)
    doc.text(label + ':', col, row)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.dark)
    doc.text(String(value), col + 28, row)
  })

  // ── Items table ──────────────────────────────────────────────────────────
  y = 80

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.medium)
  doc.text('DETALLE DE ÍTEMS', 15, y)
  y += 3

  const tableRows = items.map((item) => {
    const m = item.MarginOverride !== null && item.MarginOverride !== undefined
      ? Number(item.MarginOverride) : Number(margin)
    const salePrice = Number(item.Costo_Total_USD) * (1 + m / 100)
    const lineTotal = salePrice * Number(item.Qty)
    return [
      item.Item,
      item.Material || '—',
      `${Number(item.Qty).toFixed(2)} ${item.Unidad}`,
      fmtMoney(salePrice),
      fmtMoney(lineTotal),
    ]
  })

  autoTable(doc, {
    startY: y + 2,
    head: [['Ítem', 'Material', 'Cant. / Unidad', 'P. Venta', 'Total']],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: COLORS.dark,
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.gold,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.warm },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  })

  // ── Totals ───────────────────────────────────────────────────────────────
  const afterTable = doc.lastAutoTable.finalY + 6
  const discountAmt = subtotal * (Number(discount) / 100)

  const totalsX = W - 60
  let ty = afterTable

  const totalRow = (label, value, bold = false, color = COLORS.dark) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 8)
    doc.setTextColor(...COLORS.medium)
    doc.text(label, totalsX, ty)
    doc.setTextColor(...color)
    doc.text(value, W - 15, ty, { align: 'right' })
    ty += 6
  }

  totalRow('Subtotal:', fmtMoney(subtotal))
  if (Number(discount) > 0) {
    totalRow(`Descuento (${discount}%):`, `−${fmtMoney(discountAmt)}`)
  }

  // Final total line
  doc.setFillColor(...COLORS.dark)
  doc.rect(totalsX - 5, ty - 2, W - totalsX - 10, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.warm)
  doc.text('TOTAL FINAL:', totalsX, ty + 5)
  doc.setTextColor(...COLORS.gold)
  doc.text(fmtMoney(finalTotal), W - 15, ty + 5, { align: 'right' })
  ty += 16

  // ── Notes & terms ────────────────────────────────────────────────────────
  if (ty < H - 40) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.medium)
    doc.text(
      'Esta cotización es válida por el período indicado y sujeta a disponibilidad de materiales.',
      15, ty
    )
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, H - 12, W, 12, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.warm)
  doc.text('Ebony Custom Woodwork — Panamá', 15, H - 5)
  doc.setTextColor(...COLORS.gold)
  doc.text(id || '', W - 15, H - 5, { align: 'right' })

  // ── Save ─────────────────────────────────────────────────────────────────
  const filename = `Cotizacion_Ebony_${(cliente || 'cliente').replace(/\s+/g, '_')}_${fecha || 'sin_fecha'}.pdf`
  doc.save(filename)
}
