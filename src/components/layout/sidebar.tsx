"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Folder,
  Calendar,
  DollarSign,
  BarChart2,
  Users,
  Hammer,
  Briefcase,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
}

// Los módulos de Cotización/Proyectos/Cronograma/Gastos/Dashboard siguen
// como placeholders — links directos del rail, sin panel.
const RAIL_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

// Planilla (Taller) y Contratistas viven en el panel de "Administración",
// no en el rail — el gate de verdad sigue siendo requireAdmin() en cada
// página + RLS; esconder el ícono/panel para no-admin es solo para no
// ofrecer un link que igual rebota.
const ADMIN_PANEL_ITEMS: NavItem[] = [
  { href: "/planilla", icon: Users, label: strings.nav.taller },
  { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const { role } = useAuth();
  const pathname = usePathname();
  const isAdmin = role === "admin";

  // El panel se abre solo (sin que el usuario tenga que tocar nada) cuando
  // ya está parado en /planilla o /contratistas — ej. al refrescar la
  // página o llegar por un link directo — y además se puede abrir/cerrar
  // a mano con el ícono "Administración" del rail desde cualquier otra
  // ruta. Ambas fuentes conviven: estar en una ruta admin nunca lo deja
  // "cerrable" por accidente (es la navegación de donde ya estás parado).
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const isAdminRoute = pathname.startsWith("/planilla") || pathname.startsWith("/contratistas");
  const panelOpen = isAdmin && (isAdminRoute || manuallyOpen);

  const closeOnNavigate = () => {
    setManuallyOpen(false);
    onClose();
  };

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
        {/* Rail — angosto, siempre visible, fondo carbón (ink-700). Solo
            íconos: el isotipo arriba, los módulos placeholder, y
            "Administración" al final (no navega, abre el panel). */}
        <aside className="relative w-16 h-full flex flex-col shrink-0 bg-ink-700">
          <button
            onClick={onClose}
            className="md:hidden absolute top-1.5 right-1.5 text-cream-100/50 hover:text-cream-100"
          >
            <X size={14} />
          </button>

          <div className="h-14 flex items-center justify-center border-b border-white/10">
            <EbonyLogo variant="isotipo" tone="white" height={24} />
          </div>

          <nav className="flex-1 py-3 flex flex-col items-stretch gap-0.5 overflow-y-auto">
            {RAIL_ITEMS.map(({ href, icon: Icon, label }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeOnNavigate}
                  title={t(lang, label)}
                  aria-label={t(lang, label)}
                  className={`
                    mx-2 h-10 flex items-center justify-center rounded-none
                    transition-colors duration-100
                    ${isActive ? "bg-cream-100/15 text-cream-100" : "text-cream-100/55 hover:bg-white/10 hover:text-cream-100"}
                  `}
                >
                  <Icon size={18} className="shrink-0" />
                </Link>
              );
            })}
          </nav>

          {isAdmin && (
            <div className="py-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setManuallyOpen((o) => !o)}
                title={t(lang, strings.nav.administracion)}
                aria-label={t(lang, strings.nav.administracion)}
                aria-pressed={panelOpen}
                className={`
                  mx-2 h-10 flex items-center justify-center rounded-none
                  transition-colors duration-100
                  ${panelOpen ? "bg-cream-100/15 text-cream-100" : "text-cream-100/55 hover:bg-white/10 hover:text-cream-100"}
                `}
              >
                <Briefcase size={18} className="shrink-0" />
              </button>
            </div>
          )}
        </aside>

        {/* Panel — solo cuando "Administración" está activo. Fondo CLARO
            (stone-200): texto/íconos en ink-900, nunca los tonos claros que
            usa el rail sobre fondo oscuro — se verían invisibles acá. */}
        {panelOpen && (
          <aside className="w-56 h-full flex flex-col shrink-0 bg-stone-200 border-r border-ink-900/10">
            <div className="h-14 flex items-center px-4 border-b border-ink-900/10">
              <h2 className="text-sm font-bold text-ink-900 tracking-wide">{t(lang, strings.nav.administracion)}</h2>
            </div>

            <nav className="flex-1 py-4 px-2 overflow-y-auto">
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/50">
                {t(lang, strings.nav.panel_section_planillas)}
              </p>
              <div className="space-y-0.5">
                {ADMIN_PANEL_ITEMS.map(({ href, icon: Icon, label }) => {
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeOnNavigate}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium
                        transition-colors duration-100
                        ${isActive ? "bg-ink-900/8 text-ink-900" : "text-ink-900/70 hover:bg-ink-900/5 hover:text-ink-900"}
                      `}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span>{t(lang, label)}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ink-900" />}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
