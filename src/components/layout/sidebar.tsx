"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Folder, Calendar, DollarSign, BarChart2, X, type LucideIcon } from "lucide-react";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (typeof strings.nav)[keyof typeof strings.nav];
}

// All five modules are placeholders today (Cotización is being rebuilt from
// scratch on this base, not ported) — so unlike the old Vite version, no
// item is phase-gated/disabled. Every link is real and reachable.
const NAV_ITEMS: NavItem[] = [
  { href: "/cotizacion", icon: FileText, label: strings.nav.cotizacion },
  { href: "/proyectos", icon: Folder, label: strings.nav.proyectos },
  { href: "/cronograma", icon: Calendar, label: strings.nav.cronograma },
  { href: "/gastos", icon: DollarSign, label: strings.nav.gastos },
  { href: "/dashboard", icon: BarChart2, label: strings.nav.dashboard },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const pathname = usePathname();

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
            <p className="text-ebony-gold font-bold text-sm tracking-widest uppercase">Ebony</p>
            <p className="text-ebony-gray/50 text-[10px] tracking-wide">Custom Woodwork</p>
          </div>
          <button onClick={onClose} className="text-ebony-gray/40 hover:text-ebony-gold md:hidden">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-100
                  ${isActive ? "bg-ebony-gold/15 text-ebony-gold" : "text-ebony-gray/70 hover:bg-ebony-medium/30 hover:text-ebony-gray"}
                `}
              >
                <Icon size={16} className="shrink-0" />
                <span>{t(lang, label)}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ebony-gold" />}
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
