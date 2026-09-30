"use client";

import { LogOut, Bell } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

/**
 * Barra superior de ancho completo — acá vive la identidad de marca
 * (mockup Opción C: "ebony / woodwork studio" arriba a la izquierda,
 * sobre fondo blanco, sin franja oscura). El breadcrumb "Administración /
 * Planilla" que vivía acá se mudó adentro de cada pantalla (ver
 * `breadcrumbFor` en nav-items.ts y su uso en planilla-client.tsx) — este
 * componente ya no sabe en qué ruta está.
 */
export function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, role, signOut } = useAuth();
  const { lang, toggle } = useLang();

  return (
    <header className="h-[60px] bg-white border-b border-ink-900/8 flex items-center justify-between px-6 shrink-0">
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
        <div className="flex flex-col justify-center leading-none">
          <EbonyLogo variant="wordmark" tone="walnut" height={18} />
          <span className="mt-0.5 text-[9.5px] font-medium tracking-[0.08em] text-walnut/55 select-none">
            woodwork studio
          </span>
        </div>
      </div>

      <div className="flex items-center gap-[18px]">
        <button
          type="button"
          onClick={toggle}
          className="text-xs font-semibold text-ink-900/45 hover:text-ink-900/70 hover:border-ink-900/25 transition-colors border border-ink-900/14 rounded-[7px] px-[9px] py-1"
        >
          {lang.toUpperCase()}
        </button>
        {/* Inerte — sin backend de notificaciones todavía, mismo criterio
            que el "Pronto" del sidebar (ver strings.nav.notifications). */}
        <span
          title={t(lang, strings.nav.notifications)}
          aria-label={t(lang, strings.nav.notifications)}
          className="text-ink-900/45"
        >
          <Bell size={18} />
        </span>

        {user && (
          <div className="flex items-center gap-[9px] pl-4 border-l border-ink-900/10">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
              <img src={user.picture} alt={user.name} className="w-[30px] h-[30px] rounded-full border border-ink-900/20" />
            ) : (
              <div className="w-[30px] h-[30px] rounded-full bg-walnut flex items-center justify-center text-white text-[12px] font-bold">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="leading-[1.15]">
              <div className="text-[13px] font-semibold text-ink-900">{user.name}</div>
              {role && <div className="text-[10.5px] text-ink-900/45 capitalize">{role}</div>}
            </div>
            {/* No está en el mockup — Teofilo no mostró cómo cerrar sesión
                ahí. Se deja el ícono para no perder la función; avisar si
                se prefiere mover esto a un menú del avatar en vez de un
                ícono suelto. */}
            <button
              onClick={() => void signOut()}
              title={t(lang, strings.auth.signOut)}
              className="text-ink-900/40 hover:text-ink-900 transition-colors p-1"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
