"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, X } from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";
import { RAIL_ITEMS, ADMIN_PANEL_ITEMS } from "./nav-items";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const { role } = useAuth();
  const pathname = usePathname();
  const isAdmin = role === "admin";

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

          <div className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center mb-5 shrink-0">
            <EbonyLogo variant="isotipo" tone="white" height={20} />
          </div>

          <nav className="flex-1 flex flex-col items-center gap-1.5">
            {RAIL_ITEMS.map(({ href, icon: Icon, label }) => {
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
                  <Icon size={23} className="shrink-0" strokeWidth={1.6} />
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Panel "Administración" — solo para admins, siempre visible. */}
        {isAdmin && (
          <aside className="w-56 h-full flex flex-col shrink-0 bg-walnut-tint border-r border-black/8">
            <div className="px-5 pt-[18px] pb-4">
              {/* Identidad de marca — se movió acá del navbar (ver
                  navbar.tsx, ahora un breadcrumb). El isotipo sigue arriba
                  en la barra nogal; "ebony" chico va justo encima de
                  "Administración". */}
              <EbonyLogo variant="wordmark" tone="walnut" height={11} className="mb-1.5 opacity-75" />
              <h2 className="text-[15px] font-bold text-ink-900">{t(lang, strings.nav.administracion)}</h2>
            </div>
            <div className="h-px bg-black/8 mx-5 mb-3.5" />

            <nav className="flex-1 py-1 px-3 overflow-y-auto space-y-0.5">
              {ADMIN_PANEL_ITEMS.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`
                      w-full flex items-center gap-3 border-l-[3px] px-2.5 py-2.5 rounded-[9px] text-sm font-medium
                      transition-colors duration-100
                      ${
                        isActive
                          ? "border-walnut bg-walnut/8 text-walnut"
                          : "border-transparent text-ink-900/70 hover:bg-ink-900/5 hover:text-ink-900"
                      }
                    `}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span>{t(lang, label)}</span>
                  </Link>
                );
              })}

              {/* Placeholder — la función "Resumen de Planillas" (Taller +
                  Contratistas juntos) todavía no está construida. Cuando
                  exista su página, esto pasa a ser un <Link> más de la
                  lista de arriba, igual que Planilla/Contratistas. */}
              <div className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[9px] text-sm font-medium text-ink-900/35 cursor-not-allowed">
                <LayoutGrid size={17} className="shrink-0" />
                <span>{t(lang, strings.nav.resumenPlanillas)}</span>
                <span className="ml-auto text-[9px] font-semibold tracking-wide text-ink-900/40 bg-ink-900/6 px-1.5 py-0.5 rounded-[5px]">
                  {t(lang, strings.nav.proximamente)}
                </span>
              </div>
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
