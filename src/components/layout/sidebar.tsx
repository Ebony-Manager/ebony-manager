"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Folder, Calendar, DollarSign, BarChart2, Users, Hammer, X, type LucideIcon } from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t, strings } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
  /** Solo visible para rol admin (la Planilla es solo-admin, Fase 2). */
  adminOnly?: boolean;
}

// Los módulos de Cotización/Proyectos/Cronograma/Gastos/Dashboard siguen
// como placeholders. Planilla (Fase 2) es la primera ruta real y solo la
// ve el admin — el gate de verdad es requireAdmin() en la página + RLS;
// esconderlo acá es solo para no ofrecer un link que igual rebota.
const NAV_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
  { href: "/planilla", icon: Users, label: strings.nav.planilla, adminOnly: true },
  { href: "/contratistas", icon: Hammer, label: strings.nav.contratistas, adminOnly: true },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const { role } = useAuth();
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed top-0 left-0 h-full w-56 z-30 flex flex-col
          bg-ebony-dark border-r border-ebony-medium/30
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:flex md:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-ebony-medium/30">
          <div>
            <EbonyLogo variant="wordmark" tone="white" height={18} />
            <p className="text-ebony-gray/50 text-[10px] tracking-wide">Custom Woodwork</p>
          </div>
          <button onClick={onClose} className="text-ebony-gray/40 hover:text-cream-100 md:hidden">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {items.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium
                  transition-colors duration-100
                  ${isActive ? "bg-cream-100/15 text-cream-100" : "text-ebony-gray/70 hover:bg-ebony-medium/30 hover:text-ebony-gray"}
                `}
              >
                <Icon size={16} className="shrink-0" />
                <span>{t(lang, label)}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cream-100" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-ebony-medium/30">
          <p className="text-[10px] text-ebony-gray/25 text-center">Ebony Manager v2.0</p>
        </div>
      </aside>
    </>
  );
}
