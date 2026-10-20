"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t } from "@/lib/i18n";
import { EbonyLogo } from "@/components/brand/ebony-logo";
import { RAIL_ITEMS, ADMIN_PANEL, SETTINGS_PANEL, canSeeNavItem, isNavItemActive, type NavPanel } from "./nav-items";
import { UserMenu } from "./user-menu";

const railButton = "w-11 h-11 flex items-center justify-center rounded-md transition-colors duration-100";
const railActive = "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm";
const railIdle = "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const { role, modules } = useAuth();
  const pathname = usePathname();
  const access = { role, modules };
  const railItems = RAIL_ITEMS.filter((i) => canSeeNavItem(i, access));

  // Cada panel con solo los ítems que este usuario puede abrir.
  const visible = (panel: NavPanel) => ({ ...panel, items: panel.items.filter((i) => canSeeNavItem(i, access)) });
  const adminPanel = visible(ADMIN_PANEL);
  const settingsPanel = visible(SETTINGS_PANEL);
  const openPanel = [adminPanel, settingsPanel].find((p) => p.items.some((i) => isNavItemActive(i, pathname)));

  // Ícono del rail para un panel: un Link normal al primer ítem que el
  // usuario ve (no un toggle); el panel crema de al lado aparece solo, según
  // la ruta. Sin ítems visibles, no hay ícono.
  function panelLink(panel: NavPanel) {
    const [first] = panel.items;
    if (!first) return null;
    const Icon = panel.icon;
    return (
      <Link
        href={first.href}
        onClick={onClose}
        title={t(lang, panel.title)}
        aria-label={t(lang, panel.title)}
        className={`${railButton} ${openPanel?.key === panel.key ? railActive : railIdle}`}
      >
        <Icon size={23} className="shrink-0" strokeWidth={1.5} />
      </Link>
    );
  }

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
        {/* Rail de íconos — colores de barra lateral del tema (--sidebar-*). */}
        <aside className="relative w-[68px] h-full flex flex-col items-center shrink-0 bg-sidebar border-r border-sidebar-border py-4">
          <button
            onClick={onClose}
            className="md:hidden absolute top-1.5 right-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <X size={14} />
          </button>

          <div className="w-9 h-9 rounded-md bg-sidebar-primary flex items-center justify-center mb-[22px] shrink-0">
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
                  className={`${railButton} ${isActive ? railActive : railIdle}`}
                >
                  <Icon size={23} className="shrink-0" strokeWidth={1.5} />
                </Link>
              );
            })}

            {panelLink(adminPanel)}
          </nav>

          {/* Al pie: Settings (engranaje) y el acceso al perfil. */}
          <div className="mt-auto flex flex-col items-center gap-1.5">
            {panelLink(settingsPanel)}
            <UserMenu />
          </div>
        </aside>

        {/* Panel crema del ícono activo (Administración o Settings) — solo
            dentro de sus rutas, y solo con los ítems que el usuario puede abrir. */}
        {openPanel && (
          <aside className="w-56 h-full flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border">
            <div className="px-5 pt-[22px] pb-4">
              <h2 className="text-[15px] font-bold text-sidebar-foreground">{t(lang, openPanel.title)}</h2>
            </div>
            <div className="h-px bg-sidebar-border mx-5 mb-3.5" />

            <nav className="flex-1 py-1 px-3 overflow-y-auto space-y-0.5">
              {openPanel.items.map((item) => {
                const { href, icon: Icon, label } = item;
                const isActive = isNavItemActive(item, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-[11px] rounded-md px-3 py-[9px] text-[13.5px]
                      transition-colors duration-100
                      ${
                        isActive
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
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
