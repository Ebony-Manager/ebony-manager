"use client";

import { usePathname } from "next/navigation";
import { LogOut, Globe, Bell } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { RAIL_ITEMS, ADMIN_PANEL_ITEMS } from "./nav-items";

/**
 * "Administración / Planilla" a la izquierda — la identidad de marca ya
 * NO vive acá (se movió al panel de Administración del sidebar, ver
 * sidebar.tsx): esta franja es solo ubicación. Un módulo del rail (sin
 * panel) da un solo crumb ("Cronograma"); uno del panel de Administración
 * da dos ("Administración / Planilla"), reflejando dónde vive de verdad.
 * Sin match (ej. `/`, fuera de (app)) no rinde nada.
 */
function useBreadcrumb(pathname: string, lang: "es" | "en"): string[] {
  const adminItem = ADMIN_PANEL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (adminItem) return [t(lang, strings.nav.administracion), t(lang, adminItem.label)];
  const railItem = RAIL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (railItem) return [t(lang, railItem.label)];
  return [];
}

export function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, role, signOut } = useAuth();
  const { lang, toggle } = useLang();
  const pathname = usePathname();
  const crumbs = useBreadcrumb(pathname, lang);

  return (
    <header className="h-14 bg-cream-100 border-b border-ink-900/10 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
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

        {crumbs.length > 0 && (
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={crumb} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-ink-900/30">/</span>}
                  <span className={isLast ? "truncate font-semibold text-ink-900" : "truncate text-ink-900/50"}>
                    {crumb}
                  </span>
                </span>
              );
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-900/70 hover:text-ink-900 transition-colors px-2 py-1 rounded-none border border-ink-900/20 hover:border-ink-900/40"
        >
          <Globe size={13} />
          {lang.toUpperCase()}
        </button>

        <button
          type="button"
          title={t(lang, strings.nav.notifications)}
          aria-label={t(lang, strings.nav.notifications)}
          className="text-ink-900/60 hover:text-ink-900 transition-colors p-1.5"
        >
          <Bell size={16} />
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
