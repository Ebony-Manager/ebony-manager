import React, { useState, useRef } from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { Upload, X, AlertTriangle, CheckCircle, Circle } from 'lucide-react'
import toast from 'react-hot-toast'

const CONFIDENCE_COLORS = {
  HIGH:   'text-green-700 bg-green-50 border-green-200',
  MEDIUM: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  LOW:    'text-red-700   bg-red-50   border-red-200',
}

/**
 * "Subir Plano" button + review panel.
 * Sends file to /api/analyze-plan, shows extracted items,
 * lets user accept/edit/delete before adding to quote.
 */
export default function PlanUploader({ margin, onAddItems }) {
  const { lang } = useLang()
  const fileRef  = useRef(null)

  const [analyzing,  setAnalyzing]  = useState(false)
  const [extracted,  setExtracted]  = useState(null)  // array | null
  const [selected,   setSelected]   = useState([])    // item ids selected
  const [editValues, setEditValues] = useState({})    // { id: { qty, margin } }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede superar 10 MB.')
      return
    }

    setAnalyzing(true)
    setExtracted(null)
    setSelected([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/analyze-plan', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error del servidor')
      }

      const items = await res.json()

      if (!Array.isArray(items) || items.length === 0) {
        toast(t(lang, strings.plan.noItems))
        setExtracted([])
        return
      }

      // Assign a client-side id for tracking
      const withIds = items.map((item, i) => ({
        ...item,
        _id: `ext-${Date.now()}-${i}`,
      }))

      setExtracted(withIds)
      setSelected(withIds.map((x) => x._id))  // all selected by default
    } catch (err) {
      console.error(err)
      toast.error(t(lang, strings.plan.error))
    } finally {
      setAnalyzing(false)
      // Reset file input
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const updateEdit = (id, key, val) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: val },
    }))
  }

  const handleAddSelected = () => {
    if (!extracted) return
    const toAdd = extracted
      .filter((item) => selected.includes(item._id))
      .map((item) => {
        const edits     = editValues[item._id] || {}
        const qty       = edits.qty ?? item.m2 ?? 1
        const mgn       = edits.margin !== undefined ? edits.margin : null
        const costBase  = 0  // unknown from plan — user selects material later
        const salePrice = costBase * (1 + (mgn !== null ? Number(mgn) : Number(margin)) / 100)

        return {
          id: crypto.randomUUID(),
          type: 'extracted',
          Item: item.item,
          Categoria: item.item,
          Subcategoria: item.description || '',
          Material: '',   // to be filled by user
          Unidad: 'm²',
          Qty: Number(qty) || 1,
          Costo_Total_USD: costBase,
          SalePrice: salePrice,
          Subtotal: 0,
          LineTotal: 0,
          MarginOverride: mgn,
          confidence: item.confidence,
          notes: item.notes,
          // Original extracted data for display
          width_m: item.width_m,
          height_m: item.height_m,
          depth_m: item.depth_m,
        }
      })

    onAddItems(toAdd)
    setExtracted(null)
    setSelected([])
    setEditValues({})
    toast.success(`${toAdd.length} ítem(s) agregado(s) a la cotización`)
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={analyzing}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Upload size={16} />
        {analyzing ? t(lang, strings.plan.analyzing) : t(lang, strings.quote.uploadPlan)}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Analyzing spinner */}
      {analyzing && (
        <div className="flex items-center gap-3 text-sm text-ebony-medium bg-ebony-warm border border-ebony-gray rounded-xl px-4 py-3">
          <div className="w-4 h-4 border-2 border-ebony-gold border-t-transparent rounded-full animate-spin" />
          {t(lang, strings.plan.analyzing)}
        </div>
      )}

      {/* Review panel */}
      {extracted && extracted.length > 0 && (
        <div className="border border-ebony-gray rounded-xl overflow-hidden">
          <div className="bg-ebony-dark text-ebony-gray px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{t(lang, strings.plan.reviewTitle)}</p>
            <button onClick={() => setExtracted(null)} className="text-ebony-gray/50 hover:text-ebony-gold">
              <X size={16} />
            </button>
          </div>

          <div className="divide-y divide-ebony-gray/20 max-h-96 overflow-y-auto">
            {extracted.map((item) => {
              const edits    = editValues[item._id] || {}
              const isSelected = selected.includes(item._id)

              return (
                <div
                  key={item._id}
                  className={`px-4 py-3 flex flex-wrap gap-3 items-start transition-colors ${
                    isSelected ? 'bg-white' : 'bg-ebony-warm/30 opacity-50'
                  }`}
                >
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(item._id)} className="mt-0.5 shrink-0">
                    {isSelected
                      ? <CheckCircle size={18} className="text-ebony-gold" />
                      : <Circle size={18} className="text-ebony-gray" />
                    }
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-ebony-dark text-sm">{item.item}</p>
                    <p className="text-xs text-ebony-light">{item.description}</p>
                    {item.notes && (
                      <p className="text-xs text-ebony-light/70 italic mt-0.5">{item.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-ebony-medium">
                      {item.width_m  && <span>W: {item.width_m}m</span>}
                      {item.height_m && <span>H: {item.height_m}m</span>}
                      {item.depth_m  && <span>D: {item.depth_m}m</span>}
                    </div>
                  </div>

                  {/* Confidence badge */}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.LOW}`}>
                    {item.confidence === 'HIGH' ? t(lang, strings.plan.highConf) :
                     item.confidence === 'MEDIUM' ? t(lang, strings.plan.medConf) :
                     t(lang, strings.plan.lowConf)}
                  </span>

                  {/* m² editable */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="text-xs text-ebony-light">m²</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={edits.qty ?? item.m2 ?? ''}
                      onChange={(e) => updateEdit(item._id, 'qty', e.target.value)}
                      placeholder={item.m2 ? String(item.m2) : '?'}
                      className="input w-20 py-1 text-center text-xs"
                    />
                  </div>

                  {/* Warning for non-HIGH */}
                  {item.confidence !== 'HIGH' && (
                    <div className="w-full flex items-center gap-1 text-xs text-yellow-700">
                      <AlertTriangle size={11} />
                      {t(lang, strings.plan.lowConfWarn)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 bg-ebony-warm/50 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-ebony-light">
              {selected.length} / {extracted.length} seleccionados
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(extracted.map((x) => x._id))}
                className="btn-ghost text-xs py-1.5"
              >
                {t(lang, strings.plan.addAll)}
              </button>
              <button
                onClick={handleAddSelected}
                disabled={!selected.length}
                className="btn-primary text-xs py-1.5"
              >
                {t(lang, strings.plan.addSelected)} ({selected.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {extracted && extracted.length === 0 && (
        <p className="text-sm text-ebony-light">{t(lang, strings.plan.noItems)}</p>
      )}
    </div>
  )
}
