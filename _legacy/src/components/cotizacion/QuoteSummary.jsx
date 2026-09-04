import React from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'

/**
 * Right-hand summary panel showing totals.
 */
export default function QuoteSummary({ items, margin, discount, onDiscountChange }) {
  const { lang } = useLang()

  const subtotal = items.reduce((acc, item) => {
    const effectiveMargin = item.MarginOverride !== null && item.MarginOverride !== undefined
      ? Number(item.MarginOverride)
      : Number(margin)
    const salePrice = item.Costo_Total_USD * (1 + effectiveMargin / 100)
    return acc + salePrice * Number(item.Qty)
  }, 0)

  const discountAmt = subtotal * (Number(discount) / 100)
  const finalTotal  = subtotal - discountAmt

  const row = (label, value, cls = '') => (
    <div className={`flex justify-between items-center py-2 ${cls}`}>
      <span className="text-sm text-ebony-medium">{label}</span>
      <span className="font-semibold text-ebony-dark">${value.toFixed(2)}</span>
    </div>
  )

  return (
    <div className="card sticky top-4">
      <h3 className="font-semibold text-ebony-dark mb-3 text-sm uppercase tracking-wide">
        {t(lang, strings.quote.summary)}
      </h3>

      <div className="divide-y divide-ebony-gray/30">
        {row(t(lang, strings.common.subtotal), subtotal)}

        {/* Discount */}
        <div className="py-2">
          <label className="label">{t(lang, strings.quote.globalDiscount)}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={discount}
              onChange={(e) => onDiscountChange(e.target.value)}
              className="input w-24 text-center"
            />
            <span className="text-ebony-medium text-sm">%</span>
            {Number(discount) > 0 && (
              <span className="text-red-500 text-sm">−${discountAmt.toFixed(2)}</span>
            )}
          </div>
        </div>

        {Number(discount) > 0 && row(t(lang, strings.common.discount), discountAmt, 'text-red-500')}

        {/* Final total */}
        <div className="flex justify-between items-center pt-3">
          <span className="font-bold text-ebony-dark">
            {t(lang, strings.quote.finalTotal)}
          </span>
          <span className="text-xl font-bold text-ebony-gold">
            ${finalTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Item count */}
      <p className="text-xs text-ebony-light mt-3 text-right">
        {items.length} {lang === 'es' ? 'ítem(s)' : 'item(s)'}
      </p>
    </div>
  )
}
