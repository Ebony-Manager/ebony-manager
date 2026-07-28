import React from 'react'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { FileText, Folder, Calendar, DollarSign, BarChart2, X } from 'lucide-react'

const NAV_ITEMS = [
  { key: 'cotizacion',  icon: FileText,     label: strings.nav.cotizacion,  phase: 1 },
  { key: 'proyectos',   icon: Folder,       label: strings.nav.proyectos,   phase: 2 },
  { key: 'cronograma',  icon: Calendar,     label: strings.nav.cronograma,  phase: 3 },
  { key: 'gastos',      icon: DollarSign,   label: strings.nav.gastos,      phase: 3 },
  { key: 'dashboard',   icon: BarChart2,    label: strings.nav.dashboard,   phase: 2 },
]

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }) {
  const { lang } = useLang()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-56 z-30 flex flex-col
          bg-ebony-dark border-r border-ebony-medium/30
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:flex md:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-ebony-medium/30">
          <div>
            <p className="text-ebony-gold font-bold text-sm tracking-widest uppercase">Ebony</p>
            <p className="text-ebony-gray/50 text-[10px] tracking-wide">Custom Woodwork</p>
          </div>
          <button onClick={onClose} className="text-ebony-gray/40 hover:text-ebony-gold md:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ key, icon: Icon, label, phase }) => {
            const isActive   = currentPage === key
            const isDisabled = phase > 1

            return (
              <button
                key={key}
                onClick={() => {
                  if (!isDisabled) {
                    onNavigate(key)
                    onClose()
                  }
                }}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-100
                  ${isActive
                    ? 'bg-ebony-gold/15 text-ebony-gold'
                    : isDisabled
                      ? 'text-ebony-gray/25 cursor-not-allowed'
                      : 'text-ebony-gray/70 hover:bg-ebony-medium/30 hover:text-ebony-gray'}
                `}
              >
                <Icon size={16} className="shrink-0" />
                <span>{t(lang, label)}</span>
                {isDisabled && (
                  <span className="ml-auto text-[9px] text-ebony-gray/25 uppercase tracking-wide">
                    Pronto
                  </span>
                )}
                {isActive && !isDisabled && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ebony-gold" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-ebony-medium/30">
          <p className="text-[10px] text-ebony-gray/25 text-center">Ebony Manager v1.0</p>
        </div>
      </aside>
    </>
  )
}
