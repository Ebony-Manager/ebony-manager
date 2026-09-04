import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useLang } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { t, strings } from '../lib/i18n.js'
import { saveCotizacion, generateQuoteId } from '../lib/sheets.js'
import { exportQuotePdf } from '../lib/pdf.js'
import ItemSelector   from '../components/cotizacion/ItemSelector.jsx'
import CustomLineItem from '../components/cotizacion/CustomLineItem.jsx'
import LineItemsTable from '../components/cotizacion/LineItemsTable.jsx'
import QuoteSummary   from '../components/cotizacion/QuoteSummary.jsx'
import PlanUploader   from '../components/cotizacion/PlanUploader.jsx'
import { FileText, Save, ChevronDown } from 'lucide-react'

const TODAY = new Date().toISOString().split('T')[0]

const STATUS_OPTIONS = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada']

export default function Cotizacion() {
  const { lang }  = useLang()
  const { token } = useAuth()

  // ── Header fields ──────────────────────────────────────────────────────────
  const [cliente,    setCliente]    = useState('')
  const [disenadora, setDisenadora] = useState('')
  const [fecha,      setFecha]      = useState(TODAY)
  const [validDays,  setValidDays]  = useState(30)
  const [margin,     setMargin]     = useState(80)
  const [discount,   setDiscount]   = useState(0)
  const [status,     setStatus]     = useState('Borrador')
  const [notas,      setNotas]      = useState('')

  // ── Line items ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState([])

  const addItem    = (item)  => setItems((prev) => [...prev, item])
  const addItems   = (batch) => setItems((prev) => [...prev, ...batch])
  const removeItem = (id)    => setItems((prev) => prev.filter((x) => x.id !== id))
  const updateItem = (id, changes) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } : x)))

  // ── Computed totals ────────────────────────────────────────────────────────
  const subtotal = items.reduce((acc, item) => {
    const m = item.MarginOverride !== null && item.MarginOverride !== undefined
      ? Number(item.MarginOverride) : Number(margin)
    return acc + item.Costo_Total_USD * (1 + m / 100) * Number(item.Qty)
  }, 0)
  const finalTotal = subtotal * (1 - Number(discount) / 100)

  // ── Saving ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!cliente) { toast.error('Ingresa el nombre del cliente'); return }
    if (!items.length) { toast.error('Agrega al menos un ítem'); return }

    setSaving(true)
    try {
      const id = generateQuoteId()
      await saveCotizacion(
        token,
        {
          ID_Cotizacion: id,
          Fecha: fecha,
          Cliente: cliente,
          Diseñadora: disenadora,
          Margen_Pct: margin,
          Descuento_Global_Pct: discount,
          Total_USD: finalTotal.toFixed(2),
          Status: status,
          Notas: notas,
        },
        items.map((item) => {
          const m = item.MarginOverride !== null && item.MarginOverride !== undefined
            ? Number(item.MarginOverride) : Number(margin)
          const salePrice = item.Costo_Total_USD * (1 + m / 100)
          return {
            ...item,
            Precio_Venta_USD: salePrice.toFixed(2),
            Subtotal: (item.Costo_Total_USD * Number(item.Qty)).toFixed(2),
            LineTotal: (salePrice * Number(item.Qty)).toFixed(2),
          }
        })
      )
      toast.success(`Cotización ${id} guardada`)
    } catch (err) {
      if (!token) {
        toast.error('Configura VITE_SPREADSHEET_ID para guardar en Google Sheets')
      } else {
        toast.error('Error al guardar: ' + err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    if (!items.length) { toast.error('Agrega ítems antes de exportar'); return }
    exportQuotePdf({
      id: generateQuoteId(),
      cliente,
      disenadora,
      fecha,
      validDays,
      margin,
      discount,
      items,
      subtotal,
      finalTotal,
    })
    toast.success('PDF generado')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ebony-gold/15 flex items-center justify-center">
            <FileText size={18} className="text-ebony-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ebony-dark">{t(lang, strings.quote.title)}</h1>
            <p className="text-xs text-ebony-light">{TODAY}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportPdf} className="btn-secondary flex items-center gap-2 text-sm">
            <FileText size={15} />
            {t(lang, strings.quote.exportPdf)}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Save size={15} />
            {saving ? t(lang, strings.common.loading) : t(lang, strings.quote.saveQuote)}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — form + items (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Quote header card ─────────────────────────────────────────── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-ebony-dark text-sm uppercase tracking-wide border-b border-ebony-gray/30 pb-2">
              Información general
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t(lang, strings.quote.client)} *</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  {t(lang, strings.quote.designer)}{' '}
                  <span className="text-ebony-light/60 normal-case">({t(lang, strings.common.optional)})</span>
                </label>
                <input
                  type="text"
                  value={disenadora}
                  onChange={(e) => setDisenadora(e.target.value)}
                  placeholder="Nombre de la diseñadora"
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t(lang, strings.quote.date)}</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{t(lang, strings.quote.validDays)}</label>
                <input
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  {t(lang, strings.quote.margin)} *
                  <span className="ml-1 text-ebony-light/60 normal-case font-normal">
                    — {t(lang, strings.quote.marginHelp)}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                    className="input w-28 text-center"
                  />
                  <span className="text-ebony-medium">%</span>
                </div>
              </div>
              <div>
                <label className="label">{t(lang, strings.quote.status)}</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="select pr-8"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{t(lang, strings.quote.statuses[s])}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ebony-light" />
                </div>
              </div>
            </div>
            <div>
              <label className="label">{t(lang, strings.quote.notes)}</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Observaciones, condiciones especiales…"
                className="input resize-none"
              />
            </div>
          </div>

          {/* ── Items section ──────────────────────────────────────────────── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-ebony-dark text-sm uppercase tracking-wide border-b border-ebony-gray/30 pb-2">
              {t(lang, strings.quote.items)}
            </h2>

            {/* Plan uploader */}
            <PlanUploader margin={margin} onAddItems={addItems} />

            {/* Line items table */}
            <LineItemsTable
              items={items}
              margin={margin}
              onRemove={removeItem}
              onUpdate={updateItem}
            />

            {/* Catalog item selector */}
            <ItemSelector margin={margin} onAdd={addItem} />

            {/* Custom line item */}
            <CustomLineItem margin={margin} onAdd={addItem} />
          </div>
        </div>

        {/* Right — summary (1/3) */}
        <div className="lg:col-span-1">
          <QuoteSummary
            items={items}
            margin={margin}
            discount={discount}
            onDiscountChange={setDiscount}
          />
        </div>
      </div>
    </div>
  )
}
