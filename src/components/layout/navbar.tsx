"use client";

import { LogOut, Globe } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

export function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, role, signOut } = useAuth();
  const { lang, toggle } = useLang();

  return (
    <header className="h-14 bg-cream-100 border-b border-ink-900/10 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="text-ink-900/60 hover:text-ink-900 transition-colors p-1 rounded-none md:hidden"
          aria-label="menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex flex-col justify-center leading-none">
          <EbonyLogo variant="wordmark" tone="black" height={20} />
          <span className="mt-1 text-[10px] font-medium tracking-[0.08em] text-ink-900/50 select-none">
            woodwork studio
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-900/70 hover:text-ink-900 transition-colors px-2 py-1 rounded-none border border-ink-900/20 hover:border-ink-900/40"
        >
          <Globe size={13} />
          {lang.toUpperCase()}
        </button>

        {user && (
          <div className="flex items-center gap-2">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-ink-900/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-ink-900/10 flex items-center justify-center text-ink-900 text-xs font-bold">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-ink-900/70 text-xs hidden sm:block max-w-[120px] truncate">{user.name}</span>
            {role && (
              <span className="hidden sm:block text-[10px] uppercase tracking-wide text-ink-900/70 border border-ink-900/25 rounded-none px-1.5 py-0.5">
                {role}
              </span>
            )}
            <button
              onClick={() => void signOut()}
              title={t(lang, strings.auth.signOut)}
              className="text-ink-900/50 hover:text-ink-900 transition-colors p-1"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
