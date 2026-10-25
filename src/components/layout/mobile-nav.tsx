"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type LucideIcon } from "lucide-react";
import { useLang } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { t, strings } from "@/lib/i18n";
import { PendingBadge } from "@/components/shared/pending-badge";
import { haptic } from "@/lib/haptics";
import { EbonyMark } from "@/components/brand/ebony-logo";
import {
  RAIL_ITEMS,
  NAV_PANELS,
  ALMACEN_PANEL,
  PERSONAL_PANEL,
  SETTINGS_PANEL,
  breadcrumbFor,
  canSeeNavItem,
  isNavItemActive,
  type NavPanel,
} from "./nav-items";
import type { PendingCounts } from "./sidebar";

// Navegación en el celular (< md). Arriba: el nombre de la sección y, dentro
// de Almacén / Personal / Settings, sus pestañas deslizables. Abajo: los
// módulos a un toque, como en las apps del teléfono, y "Más" abre el menú
// completo (el mismo de la computadora, con el perfil). En computadora no se
// ve nada de esto: manda el rail de la izquierda (sidebar.tsx).

interface Destination {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  pending: number;
}

/** Orden en la barra de abajo: lo del día a día primero. */
const ORDER = ["/cotizacion", "/proyectos", "almacen", "personal", "/directorio", "/cronograma", "/gastos", "/dashboard", "settings"];
/** Pestañas de módulos en la barra de abajo; la quinta siempre es "Más" (menú completo y perfil). */
const MAX_TABS = 4;

function useNav(pending: PendingCounts) {
  const { lang } = useLang();
  const { role, modules } = useAuth();
  const pathname = usePathname();
  const access = { role, modules };
  const pendingFor = (href: string) => (href === "/personal/staff" ? pending.intakes : href === "/personal/pagos" ? pending.moneyRequests : 0);
  const visiblePanel = (panel: NavPanel) => ({ ...panel, items: panel.items.filter((i) => canSeeNavItem(i, access)) });

  const destinations: Destination[] = [];
  for (const item of RAIL_ITEMS.filter((i) => canSeeNavItem(i, access))) {
    destinations.push({
      key: item.href,
      href: item.href,
      icon: item.icon,
      label: t(lang, item.label),
      active: isNavItemActive(item, pathname),
      pending: 0,
    });
  }
  for (const panel of [ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL].map(visiblePanel)) {
    const [first] = panel.items;
    if (!first) continue;
    destinations.push({
      key: panel.key,
      href: first.href,
      icon: panel.icon,
      label: t(lang, panel.title),
      active: panel.items.some((i) => isNavItemActive(i, pathname)),
      pending: panel.items.reduce((sum, i) => sum + pendingFor(i.href), 0),
    });
  }
  destinations.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  const panel = NAV_PANELS.map(visiblePanel).find((p) => p.items.some((i) => isNavItemActive(i, pathname)));
  return { lang, pathname, destinations, panel, pendingFor };
}

/** Barra de arriba (solo celular): logo, sección y, en los módulos con pestañas, las pestañas. */
export function MobileTopBar({ pending }: { pending: PendingCounts }) {
  const { lang, pathname, panel, pendingFor } = useNav(pending);
  const crumbs = breadcrumbFor(pathname, lang);
  const title = panel ? t(lang, panel.title) : (crumbs[0] ?? "Ebony Manager");

  return (
    <header className="shrink-0 border-b border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex h-12 items-center gap-2.5 px-4">
        <EbonyMark size={26} />
        <h1 className="truncate text-[15px] font-semibold text-sidebar-foreground">{title}</h1>
      </div>
      {panel && panel.items.length > 1 && (
        // Pestañas subrayadas: llevan a otra pantalla de la sección (los filtros
        // de cada pantalla son controles segmentados grises, ver SegmentedFilter).
        <nav className="-mt-1 flex gap-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={title}>
          {panel.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-[14px] whitespace-nowrap transition-colors ${
                  active ? "border-primary font-semibold text-foreground" : "border-transparent font-medium text-sidebar-foreground/55"
                }`}
              >
                {t(lang, item.label)}
                <PendingBadge count={pendingFor(item.href)} title={t(lang, strings.nav.pending)} />
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

/** Barra de abajo (solo celular): los módulos a un toque y "Más" para el menú completo. */
export function MobileBottomNav({ pending, onOpenMenu }: { pending: PendingCounts; onOpenMenu: () => void }) {
  const { lang, destinations } = useNav(pending);
  const tabs = destinations.slice(0, MAX_TABS);
  const hidden = destinations.slice(MAX_TABS);
  const hiddenActive = hidden.some((d) => d.active);
  const hiddenPending = hidden.reduce((sum, d) => sum + d.pending, 0);

  const item = "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] leading-none transition-colors";
  const color = (active: boolean) => (active ? "font-semibold text-primary" : "text-sidebar-foreground/55");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t(lang, strings.nav.menu)}
    >
      <div className="flex h-[var(--mobile-nav-h)] items-stretch px-1">
        {tabs.map((d) => {
          const Icon = d.icon;
          return (
            <Link key={d.key} href={d.href} onClick={() => haptic()} aria-current={d.active ? "page" : undefined} className={`${item} ${color(d.active)}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${d.active ? "bg-primary/10" : ""}`}>
                <Icon size={21} strokeWidth={d.active ? 2 : 1.6} />
              </span>
              <span className="max-w-full truncate px-0.5">{d.label}</span>
              <PendingBadge count={d.pending} className="absolute top-1 left-1/2 ml-2" title={t(lang, strings.nav.pending)} />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            haptic();
            onOpenMenu();
          }}
          className={`${item} ${color(hiddenActive)}`}
        >
          <span className={`flex h-7 w-12 items-center justify-center rounded-full ${hiddenActive ? "bg-primary/10" : ""}`}>
            <Menu size={21} strokeWidth={hiddenActive ? 2 : 1.6} />
          </span>
          <span>{t(lang, strings.nav.more)}</span>
          <PendingBadge count={hiddenPending} className="absolute top-1 left-1/2 ml-2" title={t(lang, strings.nav.pending)} />
        </button>
      </div>
    </nav>
  );
}
