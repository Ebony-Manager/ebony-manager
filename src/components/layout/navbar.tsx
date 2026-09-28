"use client";

import { LogOut, Globe } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

export function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, role, signOut } = useAuth();
  const { lang, toggle } = useLang();

  return (
    <header className="h-14 bg-ebony-dark border-b border-ebony-medium/40 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-ebony-gray hover:text-cream-100 transition-colors p-1 rounded-none md:hidden"
          aria-label="menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-cream-100 font-bold tracking-wide text-base select-none">Ebony Manager</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-ebony-gray hover:text-cream-100 transition-colors px-2 py-1 rounded-none border border-ebony-medium/40 hover:border-cream-100/40"
        >
          <Globe size={13} />
          {lang.toUpperCase()}
        </button>

        {user && (
          <div className="flex items-center gap-2">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-ebony-medium/60" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-cream-100/20 flex items-center justify-center text-cream-100 text-xs font-bold">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-ebony-gray text-xs hidden sm:block max-w-[120px] truncate">{user.name}</span>
            {role && (
              <span className="hidden sm:block text-[10px] uppercase tracking-wide text-cream-100/70 border border-cream-100/30 rounded-none px-1.5 py-0.5">
                {role}
              </span>
            )}
            <button
              onClick={() => void signOut()}
              title={t(lang, strings.auth.signOut)}
              className="text-ebony-gray/60 hover:text-cream-100 transition-colors p-1"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
