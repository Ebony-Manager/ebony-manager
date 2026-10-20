"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Settings, X } from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";
import { RAIL_ITEMS, ADMIN_PANEL_ITEMS, canSeeNavItem } from "./nav-items";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const { role, modules } = useAuth();
  const pathname = usePathname();
  const access = { role, modules };
  const railItems = RAIL_ITEMS.filter((i) => canSeeNavItem(i, access));
  const panelItems = ADMIN_PANEL_ITEMS.filter((i) => canSeeNavItem(i, access));
  const [firstAdminItem] = panelItems;
  const isAdminRoute = panelItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />}

      <div
        className={`
          fixed top-0 left-0 h-full z-30 flex
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Barra nogal — íconos grandes y blancos, estilo ClickUp. */}
        <aside className="relative w-[68px] h-full flex flex-col items-center shrink-0 bg-walnut py-4">
          <button
            onClick={onClose}
            className="md:hidden absolute top-1.5 right-1.5 text-white/60 hover:text-white"
          >
            <X size={14} />
          </button>

          <div className="w-9 h-9 rounded-[10px] bg-white/16 flex items-center justify-center mb-[22px] shrink-0">
            <EbonyLogo variant="isotipo" tone="white" height={20} />
          </div>

          <nav className="flex-1 flex flex-col items-center gap-1.5">
            {railItems.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  title={t(lang, label)}
                  aria-label={t(lang, label)}
                  className={`
                    w-11 h-11 flex items-center justify-center rounded-[11px]
                    transition-colors duration-100
                    ${isActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}
                  `}
                >
                  <Icon size={23} className="shrink-0" strokeWidth={1.5} />
                </Link>
              );
            })}

            {/* Administración — un Link normal como los de arriba (no un
                toggle que abre/cierra nada); el panel crema de al lado
                aparece solo, según la ruta (ver isAdminRoute), al entrar
                acá. Solo si el usuario ve al menos un ítem del panel
                (Planilla, Contratistas, Usuarios…). */}
            {firstAdminItem && (
              <Link
                href={firstAdminItem.href}
                onClick={onClose}
                title={t(lang, strings.nav.administracion)}
                aria-label={t(lang, strings.nav.administracion)}
                className={`
                  w-11 h-11 flex items-center justify-center rounded-[11px]
                  transition-colors duration-100
                  ${isAdminRoute ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}
                `}
              >
                <Briefcase size={23} className="shrink-0" strokeWidth={1.5} />
              </Link>
            )}
          </nav>

          {/* Inerte por ahora — el mockup lo pinta pero no define a dónde
              lleva (¿ajustes de perfil? ¿de la app?). Avisar antes de
              cablearlo a algo. */}
          <div
            className="mt-auto w-11 h-11 flex items-center justify-center rounded-[11px] text-white/65"
            title={t(lang, strings.nav.settings)}
          >
            <Settings size={20} strokeWidth={1.5} />
          </div>
        </aside>

        {/* Panel "Administración" — solo dentro de sus rutas, y solo con
            los ítems que el usuario puede abrir. */}
        {isAdminRoute && (
          <aside className="w-56 h-full flex flex-col shrink-0 bg-cream-100 border-r border-ink-900/8">
            <div className="px-5 pt-[22px] pb-4">
              <h2 className="text-[15px] font-bold text-ink-900">{t(lang, strings.nav.administracion)}</h2>
            </div>
            <div className="h-px bg-ink-900/8 mx-5 mb-3.5" />

            <nav className="flex-1 py-1 px-3 overflow-y-auto space-y-0.5">
              {panelItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-[11px] rounded-[9px] text-[13.5px]
                      transition-colors duration-100
                      ${
                        isActive
                          ? "border-l-[3px] border-walnut bg-walnut-tint py-[9px] pl-[10px] pr-3 font-semibold text-walnut"
                          : "border-l-[3px] border-transparent py-[9px] px-3 font-medium text-ink-900/55 hover:bg-ink-900/5 hover:text-ink-900"
                      }
                    `}
                  >
                    <Icon size={18} className="shrink-0" strokeWidth={1.7} />
                    <span>{t(lang, label)}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
