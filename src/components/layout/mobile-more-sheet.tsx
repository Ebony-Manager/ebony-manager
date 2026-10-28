"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { BellRing, Languages, LogOut, Monitor, Moon, Share2, Sun, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { useTheme, type ThemePref } from "@/context/theme-context";
import { t, strings } from "@/lib/i18n";
import { PendingBadge } from "@/components/shared/pending-badge";
import type { LucideIcon } from "lucide-react";
import { orderNavigation, RAIL_ITEMS, ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL, canSeeNavItem, isNavItemActive, panelHome, type NavItem } from "./nav-items";
import type { PendingCounts } from "./sidebar";
import { shareLink, visibleQuickLinks } from "./quick-links";

const THEMES: { value: ThemePref; icon: typeof Sun; label: keyof typeof strings.nav }[] = [
  { value: "light", icon: Sun, label: "theme_light" },
  { value: "dark", icon: Moon, label: "theme_dark" },
  { value: "system", icon: Monitor, label: "theme_system" },
];

/** Secciones grandes (botón grande, con sus pestañas debajo) y accesos chicos. */
const BIG = ["/dashboard", "almacen", "/proyectos", "personal"];
/** Herramientas: chicas, salvo para quien no tiene ninguna sección grande (solo el Dashboard), que las ve grandes. */
const TOOLS = ["/cotizacion", "/inspecciones"];
const SMALL = ["/directorio", "settings"];

interface Entry {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  /** Las pestañas que trae (solo secciones con panel). */
  tabs: string[];
  active: boolean;
  pending: number;
}

/**
 * "Más" en el celular: una hoja que sube desde abajo. Arriba, botones grandes
 * para las secciones principales (Dashboard, Almacén, Proyectos, Personal),
 * cada uno con las pestañas que trae; abajo, accesos chicos (Cotización,
 * Inspecciones, Directorio, Settings) y las preferencias del perfil en una
 * franja. Quien solo tiene herramientas (ej. solo Inspecciones) las ve en
 * grande. Cada
 * botón lleva al inicio de su sección (ver `panelHome`); adentro, pestañas.
 * Solo muestra lo que el usuario puede abrir.
 */
export function MobileMoreSheet({ open, onClose, pending }: { open: boolean; onClose: () => void; pending: PendingCounts }) {
  const { user, role, modules, signOut } = useAuth();
  const { lang, toggle } = useLang();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const access = { role, modules };
  // Cerrar sesión pide un segundo toque (está al alcance del dedo al abrir el menú).
  const [armSignOut, setArmSignOut] = React.useState(false);
  React.useEffect(() => {
    if (!armSignOut) return;
    const id = window.setTimeout(() => setArmSignOut(false), 4000);
    return () => window.clearTimeout(id);
  }, [armSignOut]);
  const close = () => {
    setArmSignOut(false);
    onClose();
  };
  const tl = (label: NavItem["label"]) => t(lang, label);
  const pendingFor = (href: string) => (href === "/personal/staff" ? pending.intakes : href === "/personal/pagos" ? pending.moneyRequests : 0);

  const entries: Entry[] = [];
  for (const item of RAIL_ITEMS.filter((i) => canSeeNavItem(i, access))) {
    entries.push({ key: item.href, href: item.href, icon: item.icon, label: tl(item.label), tabs: [], active: isNavItemActive(item, pathname), pending: 0 });
  }
  for (const panel of [ALMACEN_PANEL, PERSONAL_PANEL, SETTINGS_PANEL]) {
    const items = panel.items.filter((i) => canSeeNavItem(i, access));
    const home = panelHome({ ...panel, items }, access);
    if (!home) continue;
    entries.push({
      key: panel.key,
      href: home.href,
      icon: panel.icon,
      label: t(lang, panel.title),
      tabs: items.length > 1 ? items.map((i) => tl(i.label)) : [],
      active: items.some((i) => isNavItemActive(i, pathname)),
      pending: items.reduce((sum, i) => sum + pendingFor(i.href), 0),
    });
  }
  const pick = (keys: string[]) => keys.map((k) => entries.find((e) => e.key === k)).filter((e): e is Entry => !!e);
  const sections = pick(BIG);
  // Almacén con solo Compras (pedir lo que haga falta, lo ven todos) no cuenta como sección propia.
  const toolsBig = sections.every((e) => e.key === "/dashboard" || (e.key === "almacen" && e.tabs.length === 0));
  const big = orderNavigation(toolsBig ? [...pick(TOOLS), ...sections] : sections, "mobile", access);
  const small = toolsBig ? pick(SMALL) : pick([...TOOLS, ...SMALL]);
  const forms = visibleQuickLinks(access);

  return (
    // Cerrado queda invisible (después de la animación): el Safari del iPhone
    // toma el color de lo que está fijo arriba para pintar la barra de estado,
    // y un velo transparente pero presente la dejaba gris.
    <div
      className={`fixed inset-0 z-40 transition-[visibility] duration-200 md:hidden ${open ? "visible" : "pointer-events-none invisible"}`}
      aria-hidden={!open}
    >
      <div className={`absolute inset-0 transition-opacity duration-200 ${open ? "bg-black/40 opacity-100" : "bg-transparent opacity-0"}`} onClick={close} />
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
            onClick={close}
            aria-label={t(lang, strings.nav.close)}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Secciones principales: botones grandes, dos por fila (el último solo, a todo el ancho). */}
          {big.length > 0 && (
            <nav className="grid grid-cols-2 gap-2 pt-1 pb-3" aria-label={t(lang, strings.nav.menu)}>
              {big.map((e, i) => {
                const Icon = e.icon;
                return (
                  <Link
                    key={e.key}
                    href={e.href}
                    onClick={close}
                    aria-current={e.active ? "page" : undefined}
                    className={`relative flex min-h-24 flex-col justify-between gap-2 rounded-xl border p-3 ${
                      big.length % 2 === 1 && i === big.length - 1 ? "col-span-2" : ""
                    } ${e.active ? "border-primary bg-primary/10" : "border-border bg-background active:bg-muted"}`}
                  >
                    <span className={`flex size-10 items-center justify-center rounded-lg ${e.active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      <Icon size={22} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-foreground">{e.label}</span>
                      {e.tabs.length > 0 && <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{e.tabs.join(" · ")}</span>}
                    </span>
                    <PendingBadge count={e.pending} className="absolute top-2 right-2" title={t(lang, strings.nav.pending)} />
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Formularios de JotForm (según permiso): abren en otra pestaña. */}
          {forms.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-border py-3" aria-label={t(lang, strings.nav.forms)}>
              <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(lang, strings.nav.forms)}</h3>
              <div className="grid grid-cols-2 gap-2">
                {forms.map((f) => {
                  const Icon = f.icon;
                  const cls = "flex min-h-12 items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground active:bg-muted";
                  const body = (
                    <>
                      <Icon size={18} strokeWidth={1.8} className="shrink-0 text-primary" />
                      <span className="flex-1 leading-tight">{t(lang, f.label)}</span>
                      {f.action === "share" && <Share2 size={15} className="shrink-0 text-muted-foreground" />}
                    </>
                  );
                  return f.action === "share" ? (
                    <button
                      key={f.key}
                      type="button"
                      className={cls}
                      onClick={() =>
                        void shareLink(f.href, t(lang, strings.nav.form_registro_share_text), t(lang, f.label)).then(
                          (r) => r === "copied" && toast.success(t(lang, strings.nav.link_copied)),
                        )
                      }
                    >
                      {body}
                    </button>
                  ) : (
                    <a key={f.key} href={f.href} target="_blank" rel="noreferrer" onClick={close} className={cls}>
                      {body}
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* Accesos chicos. */}
          {small.length > 0 && (
            <nav className={`grid gap-2 border-t border-border py-3 ${small.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
              {small.map((e) => {
                const Icon = e.icon;
                return (
                  <Link
                    key={e.key}
                    href={e.href}
                    onClick={close}
                    aria-current={e.active ? "page" : undefined}
                    className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-lg text-xs ${
                      e.active ? "bg-primary/10 font-semibold text-primary" : "text-foreground active:bg-muted"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.7} />
                    <span className="max-w-full truncate px-1">{e.label}</span>
                    <PendingBadge count={e.pending} className="absolute top-1 right-3" title={t(lang, strings.nav.pending)} />
                  </Link>
                );
              })}
            </nav>
          )}

          <Link
            href="/perfil/notificaciones"
            onClick={close}
            className="flex h-12 items-center gap-2.5 border-t border-border px-2 text-sm font-medium text-foreground active:bg-muted"
          >
            <BellRing size={18} className="text-primary" />
            {t(lang, strings.nav.my_notifications)}
          </Link>

          {/* Preferencias en una franja: tema (íconos), idioma y salir. */}
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label={t(lang, strings.nav.theme)}>
              {THEMES.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-label={t(lang, strings.nav[label])}
                  aria-pressed={theme === value}
                  className={`flex size-9 items-center justify-center rounded-md ${theme === value ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={t(lang, strings.nav.language)}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold active:bg-muted"
            >
              <Languages size={16} />
              {lang === "es" ? "ES" : "EN"}
            </button>
            <button
              type="button"
              onClick={() => (armSignOut ? void signOut() : setArmSignOut(true))}
              className={`ml-auto flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm ${
                armSignOut ? "bg-destructive font-semibold text-white" : "text-destructive active:bg-muted"
              }`}
            >
              <LogOut size={16} />
              {armSignOut ? t(lang, strings.nav.confirm_signout) : t(lang, strings.auth.signOut)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
