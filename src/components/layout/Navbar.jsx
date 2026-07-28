import React from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LanguageContext.jsx'
import { t, strings } from '../../lib/i18n.js'
import { LogOut, Globe } from 'lucide-react'

export default function Navbar({ onMenuToggle }) {
  const { user, signOut } = useAuth()
  const { lang, toggle } = useLang()

  return (
    <header className="h-14 bg-ebony-dark border-b border-ebony-medium/40 flex items-center justify-between px-4 shrink-0">
      {/* Left — hamburger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-ebony-gray hover:text-ebony-gold transition-colors p-1 rounded md:hidden"
          aria-label="menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-ebony-gold font-bold tracking-wide text-base select-none">
          Ebony Manager
        </span>
      </div>

      {/* Right — language + user */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-ebony-gray hover:text-ebony-gold transition-colors px-2 py-1 rounded-lg border border-ebony-medium/40 hover:border-ebony-gold/40"
        >
          <Globe size={13} />
          {lang.toUpperCase()}
        </button>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-ebony-medium/60" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-ebony-gold/20 flex items-center justify-center text-ebony-gold text-xs font-bold">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-ebony-gray text-xs hidden sm:block max-w-[120px] truncate">{user.name}</span>
            <button
              onClick={signOut}
              title={t(lang, strings.auth.signOut)}
              className="text-ebony-gray/60 hover:text-ebony-gold transition-colors p-1"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
