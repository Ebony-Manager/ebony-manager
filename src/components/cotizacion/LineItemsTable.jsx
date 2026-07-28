import React from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { Trash2, AlertTriangle } from 'lucide-react'

/**
 * Displays the current quote line items in a table.
 * Allows inline qty / margin edits and row deletion.
 */
export default function LineItemsTable({ items, margin, onRemove, onUpdate }) {
  const { lang } = useLang()

  if (!items.length) {
    return (
      <div className="border border-dashed border-ebony-gray/50 rounded-xl p-8 text-center">
        <p className="text-ebony-light text-sm">
          {lang === 'es'
            ? 'Agrega ítems desde el catálogo o crea líneas personalizadas.'
            : 'Add items from the catalog or create custom lines.'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ebony-gray/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ebony-dark text-ebony-gray/80 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Ítem</th>
            <th className="text-left px-3 py-3 hidden md:table-cell">Material</th>
            <th className="text-center px-3 py-3">Cant.</th>
            <th className="text-right px-3 py-3 hidden sm:table-cell">Costo base</th>
            <th className="text-center px-3 py-3 hidden lg:table-cell">Margen %</th>
            <th className="text-right px-3 py-3">P. venta</th>
            <th className="text-right px-4 py-3">Total línea</th>
            <th className="px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ebony-gray/20">
          {items.map((item) => {
            const effectiveMargin = item.MarginOverride !== null && item.MarginOverride !== undefined
              ? Number(item.MarginOverride)
              : Number(margin)
            const salePrice = item.Costo_Total_USD * (1 + effectiveMargin / 100)
            const lineTotal = salePrice * Number(item.Qty)

            return (
              <tr key={item.id} className="bg-white hover:bg-ebony-warm/40 transition-colors">
                {/* Item name */}
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-ebony-dark">{item.Item}</p>
                    {item.Subcategoria && (
                      <p className="text-ebony-light text-xs">{item.Subcategoria}</p>
                    )}
                    {item.type === 'extracted' && (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5
                        ${item.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                          item.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'}`}>
                        {item.confidence !== 'HIGH' && <AlertTriangle size={9} />}
                        {item.confidence}
                      </span>
                    )}
                  </div>
                </td>

                {/* Material */}
                <td className="px-3 py-3 hidden md:table-cell text-ebony-medium">
                  {item.Material || <span className="text-ebony-gray italic">—</span>}
                </td>

                {/* Qty */}
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.Qty}
                      onChange={(e) => onUpdate(item.id, { Qty: e.target.value })}
                      className="input w-20 text-center py-1 text-xs"
                    />
                    <span className="text-ebony-light text-xs">{item.Unidad}</span>
                  </div>
                </td>

                {/* Costo base */}
                <td className="px-3 py-3 text-right hidden sm:table-cell text-ebony-medium">
                  ${Number(item.Costo_Total_USD).toFixed(2)}
                </td>

                {/* Margin override */}
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  <input
                    type="number"
                    placeholder={`${margin}`}
                    value={item.MarginOverride ?? ''}
                    onChange={(e) => onUpdate(item.id, {
                      MarginOverride: e.target.value === '' ? null : e.target.value
                    })}
                    className="input w-20 text-center py-1 text-xs"
                  />
                </td>

                {/* Sale price */}
                <td className="px-3 py-3 text-right font-medium">
                  ${salePrice.toFixed(2)}
                </td>

                {/* Line total */}
                <td className="px-4 py-3 text-right font-bold text-ebony-gold">
                  ${lineTotal.toFixed(2)}
                </td>

                {/* Delete */}
                <td className="px-2 py-3">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-ebony-gray/40 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
