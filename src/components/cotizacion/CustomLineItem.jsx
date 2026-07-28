import React, { useState } from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { Plus } from 'lucide-react'

/**
 * Free-form line item for non-catalog products.
 */
export default function CustomLineItem({ margin, onAdd }) {
  const { lang } = useLang()
  const [name,     setName]     = useState('')
  const [cost,     setCost]     = useState('')
  const [qty,      setQty]      = useState(1)
  const [unit,     setUnit]     = useState('unidad')
  const [lineMgn,  setLineMgn]  = useState(null)

  const effectiveMargin = lineMgn !== null ? Number(lineMgn) : Number(margin)
  const costNum   = Number(cost) || 0
  const salePrice = costNum * (1 + effectiveMargin / 100)
  const lineTotal = salePrice * Number(qty)

  const handleAdd = () => {
    if (!name || !cost) return
    onAdd({
      id: crypto.randomUUID(),
      type: 'custom',
      Item: name,
      Categoria: 'Personalizado',
      Subcategoria: '',
      Material: '',
      Unidad: unit,
      Qty: Number(qty),
      Costo_Total_USD: costNum,
      SalePrice: salePrice,
      Subtotal: costNum * Number(qty),
      LineTotal: lineTotal,
      MarginOverride: lineMgn,
    })
    setName(''); setCost(''); setQty(1); setLineMgn(null)
  }

  return (
    <div className="bg-ebony-warm/60 border border-dashed border-ebony-gray rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-ebony-medium uppercase tracking-wide">
        {t(lang, strings.quote.addCustom)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <label className="label">{t(lang, strings.quote.itemName)}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Panelado Curvo, Bufetera…"
            className="input"
          />
        </div>
        <div>
          <label className="label">{t(lang, strings.quote.customCost)}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="input"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">{t(lang, strings.quote.qty)} / {t(lang, strings.quote.unit)}</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="input w-20"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="select flex-1"
            >
              <option value="unidad">unidad</option>
              <option value="m²">m²</option>
              <option value="ml">ml</option>
              <option value="global">global</option>
            </select>
          </div>
        </div>
      </div>

      {cost > 0 && (
        <div className="flex flex-wrap items-end gap-4 text-sm pt-1">
          <div>
            <span className="text-ebony-light text-xs">Margen: </span>
            <input
              type="number"
              placeholder={`${margin}% (global)`}
              value={lineMgn ?? ''}
              onChange={(e) => setLineMgn(e.target.value === '' ? null : e.target.value)}
              className="input w-28 py-1 text-center"
            />
          </div>
          <div>
            <span className="text-ebony-light text-xs">{t(lang, strings.quote.salePrice)}: </span>
            <span className="font-semibold">${salePrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-ebony-light text-xs">{t(lang, strings.quote.lineTotal)}: </span>
            <span className="font-bold text-ebony-gold">${lineTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!name || !cost}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Plus size={16} />
        {t(lang, strings.quote.addCustom)}
      </button>
    </div>
  )
}
