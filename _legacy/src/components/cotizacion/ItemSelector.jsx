import React, { useState, useEffect } from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { usePrecios } from '../../hooks/usePrecios.js'
import { Plus, ChevronDown } from 'lucide-react'

/**
 * Dropdown selector for catalog items.
 * On "Agregar" emits { categoria, subcategoria, material, unidad,
 *   costo_base, qty, subtotal, salePrice, lineTotal }
 */
export default function ItemSelector({ margin, onAdd }) {
  const { lang } = useLang()
  const { loading, error, categories, subcategories, materials, getItem } = usePrecios()

  const [cat,    setCat]    = useState('')
  const [sub,    setSub]    = useState('')
  const [mat,    setMat]    = useState('')
  const [qty,    setQty]    = useState(1)
  const [lineMargin, setLineMargin] = useState(null) // null = use global

  const subs  = cat ? subcategories(cat) : []
  const mats  = (cat && sub) ? materials(cat, sub) : []
  const item  = (cat && sub && mat) ? getItem(cat, sub, mat) : null

  const effectiveMargin = lineMargin !== null ? Number(lineMargin) : Number(margin)
  const costBase  = item ? Number(item.Costo_Total_USD) : 0
  const salePrice = costBase * (1 + effectiveMargin / 100)
  const lineTotal = salePrice * Number(qty)

  // Reset downstream when upstream changes
  useEffect(() => { setSub(''); setMat('') }, [cat])
  useEffect(() => { setMat('') }, [sub])

  const handleAdd = () => {
    if (!item) return
    onAdd({
      id: crypto.randomUUID(),
      type: 'catalog',
      Item: `${cat} — ${sub}`,
      Categoria: cat,
      Subcategoria: sub,
      Material: mat,
      Unidad: item.Unidad,
      Qty: Number(qty),
      Costo_Total_USD: costBase,
      SalePrice: salePrice,
      Subtotal: costBase * Number(qty),
      LineTotal: lineTotal,
      MarginOverride: lineMargin,
    })
    // Reset
    setCat(''); setSub(''); setMat(''); setQty(1); setLineMargin(null)
  }

  if (loading) return (
    <div className="skeleton h-10 rounded-lg w-full" />
  )

  return (
    <div className="bg-ebony-warm/60 border border-ebony-gray rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-ebony-medium uppercase tracking-wide">
        {t(lang, strings.quote.addItem)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Categoria */}
        <div>
          <label className="label">{t(lang, strings.quote.category)}</label>
          <div className="relative">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="select pr-8"
            >
              <option value="">—</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ebony-light" />
          </div>
        </div>

        {/* Subcategoria */}
        <div>
          <label className="label">{t(lang, strings.quote.subcategory)}</label>
          <div className="relative">
            <select
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              disabled={!cat}
              className="select pr-8 disabled:opacity-40"
            >
              <option value="">—</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ebony-light" />
          </div>
        </div>

        {/* Material */}
        <div>
          <label className="label">{t(lang, strings.quote.material)}</label>
          <div className="relative">
            <select
              value={mat}
              onChange={(e) => setMat(e.target.value)}
              disabled={!sub}
              className="select pr-8 disabled:opacity-40"
            >
              <option value="">—</option>
              {mats.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ebony-light" />
          </div>
        </div>

        {/* Qty */}
        <div>
          <label className="label">
            {t(lang, strings.quote.qty)} {item && <span className="text-ebony-gold normal-case">({item.Unidad})</span>}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Preview + optional margin override */}
      {item && (
        <div className="flex flex-wrap items-end gap-4 text-sm pt-1">
          <div>
            <span className="text-ebony-light text-xs">{t(lang, strings.quote.costPerUnit)}: </span>
            <span className="font-medium">${costBase.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-ebony-light text-xs">Margen: </span>
            <input
              type="number"
              placeholder={`${margin}% (global)`}
              value={lineMargin ?? ''}
              onChange={(e) => setLineMargin(e.target.value === '' ? null : e.target.value)}
              className="input w-28 py-1 text-center"
            />
          </div>
          <div>
            <span className="text-ebony-light text-xs">{t(lang, strings.quote.salePrice)}: </span>
            <span className="font-semibold text-ebony-dark">${salePrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-ebony-light text-xs">{t(lang, strings.quote.lineTotal)}: </span>
            <span className="font-bold text-ebony-gold">${lineTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!item}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        <Plus size={16} />
        {t(lang, strings.quote.addItem)}
      </button>
    </div>
  )
}
