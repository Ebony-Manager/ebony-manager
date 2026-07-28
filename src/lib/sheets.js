/**
 * Google Sheets API v4 — thin client layer
 * All calls use the OAuth token from AuthContext.
 *
 * SPREADSHEET_ID is set via VITE_SPREADSHEET_ID env var.
 */

const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`

// ─── helpers ──────────────────────────────────────────────────────────────────

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function sheetsGet(token, range) {
  const url = `${BASE_URL}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Sheets API error')
  }
  return res.json()
}

async function sheetsAppend(token, range, rows) {
  const url = `${BASE_URL}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ values: rows }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Sheets API error')
  }
  return res.json()
}

/** Convert a 2D values array + header row into array of plain objects */
function toObjects(values) {
  if (!values || values.length < 2) return []
  const [headerRow, ...rows] = values
  return rows.map((row) =>
    Object.fromEntries(headerRow.map((h, i) => [h, row[i] ?? '']))
  )
}

// ─── Precios_Referencia ────────────────────────────────────────────────────────

/**
 * Fetch all items from Precios_Referencia.
 * Returns array of { ID_Item, Categoria, Subcategoria, Material, Unidad,
 *   Costo_Total_USD, Margen_Utilidad_Pct, Precio_Venta_USD,
 *   Ultima_Actualizacion, Notas }
 */
export async function fetchPrecios(token) {
  const data = await sheetsGet(token, 'Precios_Referencia!A:J')
  return toObjects(data.values)
}

// ─── Cotizaciones ──────────────────────────────────────────────────────────────

/**
 * Fetch all quotes from Cotizaciones.
 */
export async function fetchCotizaciones(token) {
  const data = await sheetsGet(token, 'Cotizaciones!A:L')
  return toObjects(data.values)
}

/**
 * Save a quote (header + all line items) to Cotizaciones sheet.
 *
 * quoteHeader: { ID_Cotizacion, ID_Proyecto?, Fecha, Cliente, Diseñadora,
 *                Margen_Pct, Descuento_Global_Pct, Total_USD, Status, Notas }
 * lineItems:   Array of { Item, Categoria, Subcategoria, Material, Unidad,
 *                         Qty, Costo_Total_USD, Precio_Venta_USD, Subtotal }
 *
 * Each line item is saved as a separate row with the header fields repeated
 * (denormalized) for easy filtering.
 */
export async function saveCotizacion(token, quoteHeader, lineItems) {
  const {
    ID_Cotizacion,
    ID_Proyecto = '',
    Fecha,
    Cliente,
    Diseñadora = '',
    Margen_Pct,
    Descuento_Global_Pct = 0,
    Total_USD,
    Status = 'Borrador',
    Notas = '',
  } = quoteHeader

  const rows = lineItems.map((item) => [
    ID_Cotizacion,
    ID_Proyecto,
    Fecha,
    item.Item,
    item.Categoria,
    item.M2 ?? item.Qty,           // M2 column — store qty regardless of unit
    item.Precio_Venta_USD,
    item.Subtotal,
    Descuento_Global_Pct,
    item.LineTotal ?? item.Subtotal,
    Status,
    // extra columns (Cliente, Diseñadora, Margen, Total, Notas on first row only)
  ])

  // Prepend a header row with full quote info as the first data row
  rows[0] = [
    ID_Cotizacion,
    ID_Proyecto,
    Fecha,
    lineItems[0]?.Item ?? '',
    lineItems[0]?.Categoria ?? '',
    lineItems[0]?.M2 ?? lineItems[0]?.Qty ?? 0,
    lineItems[0]?.Precio_Venta_USD ?? 0,
    lineItems[0]?.Subtotal ?? 0,
    Descuento_Global_Pct,
    lineItems[0]?.LineTotal ?? lineItems[0]?.Subtotal ?? 0,
    Status,
  ]

  await sheetsAppend(token, 'Cotizaciones!A:K', rows)

  // Also save metadata to Proyectos if needed — left as future enhancement
  return ID_Cotizacion
}

// ─── ID generation ─────────────────────────────────────────────────────────────

/** Generate a quote ID like COT-20250601-001 */
export function generateQuoteId() {
  const date = new Date()
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900) + 100
  return `COT-${yyyymmdd}-${rand}`
}
