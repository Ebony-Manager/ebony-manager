"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages, LogOut, Monitor, Moon, Sun, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { useTheme, type ThemePref } from "@/context/theme-context";
import { t, strings } from "@/lib/i18n";
import { PendingBadge } from "@/components/shared/pending-badge";
import { RAIL_ITEMS, ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL, canSeeNavItem, isNavItemActive, type NavItem } from "./nav-items";
import type { PendingCounts } from "./sidebar";

const THEMES: { value: ThemePref; icon: typeof Sun; label: keyof typeof strings.nav }[] = [
  { value: "light", icon: Sun, label: "theme_light" },
  { value: "dark", icon: Moon, label: "theme_dark" },
  { value: "system", icon: Monitor, label: "theme_system" },
];

/**
 * "Más" en el celular: una hoja que sube desde abajo con todo el menú, con
 * nombres (no solo íconos): los módulos, las secciones de Almacén / Personal
 * / Settings y las preferencias del perfil (tema, idioma, cerrar sesión).
 * Solo muestra lo que el usuario puede abrir.
 */
export function MobileMoreSheet({ open, onClose, pending }: { open: boolean; onClose: () => void; pending: PendingCounts }) {
  const { user, role, modules, signOut } = useAuth();
  const { lang, toggle } = useLang();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const access = { role, modules };
  const tl = (label: NavItem["label"]) => t(lang, label);
  const pendingFor = (href: string) => (href === "/personal/staff" ? pending.intakes : href === "/personal/pagos" ? pending.moneyRequests : 0);

  const modulesList = RAIL_ITEMS.filter((i) => canSeeNavItem(i, access));
  const panels = [ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL]
    .map((p) => ({ ...p, items: p.items.filter((i) => canSeeNavItem(i, access)) }))
    .filter((p) => p.items.length > 0);

  const row = (item: NavItem) => {
    const active = isNavItemActive(item, pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] ${active ? "bg-primary/10 font-semibold text-primary" : "text-foreground active:bg-muted"}`}
      >
        <Icon size={19} strokeWidth={1.7} className="shrink-0" />
        <span className="flex-1">{tl(item.label)}</span>
        <PendingBadge count={pendingFor(item.href)} title={t(lang, strings.nav.pending)} />
      </Link>
    );
  };

  return (
    // Cerrado queda invisible (después de la animación): el Safari del iPhone
    // toma el color de lo que está fijo arriba para pintar la barra de estado,
    // y un velo transparente pero presente la dejaba gris.
    <div
      className={`fixed inset-0 z-40 transition-[visibility] duration-200 md:hidden ${open ? "visible" : "pointer-events-none invisible"}`}
      aria-hidden={!open}
    >
      <div className={`absolute inset-0 transition-opacity duration-200 ${open ? "bg-black/40 opacity-100" : "bg-transparent opacity-0"}`} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(lang, strings.nav.menu)}
        className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-card shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 pt-3 pb-3">
          {user?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar de Google (URL externa)
            <img src={user.picture} alt="" className="size-10 rounded-full border border-border" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {user?.email}
              {role ? ` · ${t(lang, role === "admin" ? strings.usuarios.role_admin : strings.usuarios.role_user)}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, strings.nav.close)}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {modulesList.length > 0 && <nav className="flex flex-col gap-0.5 border-b border-border pb-2">{modulesList.map(row)}</nav>}
          {panels.map((p) => (
            <nav key={p.key} className="flex flex-col gap-0.5 border-b border-border py-2" aria-label={t(lang, p.title)}>
              <h3 className="px-3 pt-1 pb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(lang, p.title)}</h3>
              {p.items.map(row)}
            </nav>
          ))}

          <div className="flex flex-col gap-3 py-3">
            <div className="flex flex-col gap-1.5 px-3">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(lang, strings.nav.theme)}</span>
              <div className="grid grid-cols-3 gap-1.5">
                {THEMES.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm ${theme === value ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border"}`}
                  >
                    <Icon size={15} />
                    {t(lang, strings.nav[label])}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={toggle} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] active:bg-muted">
              <Languages size={19} strokeWidth={1.7} />
              <span className="flex-1 text-left">{t(lang, strings.nav.language)}</span>
              <span className="text-sm font-semibold text-muted-foreground">{lang === "es" ? "Español" : "English"}</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] text-destructive active:bg-muted"
            >
              <LogOut size={19} strokeWidth={1.7} />
              {t(lang, strings.auth.signOut)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
