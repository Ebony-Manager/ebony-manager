"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Languages, LogOut, Monitor, Moon, Share2, Sun } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { useTheme, type ThemePref } from "@/context/theme-context";
import { t, strings } from "@/lib/i18n";
import { shareLink, visibleQuickLinks } from "./quick-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_OPTIONS: { value: ThemePref; icon: typeof Sun; label: keyof typeof strings.nav }[] = [
  { value: "light", icon: Sun, label: "theme_light" },
  { value: "dark", icon: Moon, label: "theme_dark" },
  { value: "system", icon: Monitor, label: "theme_system" },
];

/**
 * Acceso al perfil, abajo a la izquierda del rail (antes vivía en la barra
 * superior, que ya no existe): la foto o inicial abre un menú con nombre,
 * correo y rol, el tema (claro / oscuro / automático), el idioma y cerrar
 * sesión.
 */
export function UserMenu() {
  const { user, role, modules, signOut } = useAuth();
  const { lang, toggle } = useLang();
  const { theme, setTheme } = useTheme();
  // Cerrar sesión: el primer toque pregunta (el menú sigue abierto), el segundo sale.
  const [armSignOut, setArmSignOut] = React.useState(false);
  if (!user) return null;

  const initial = user.name?.[0]?.toUpperCase();
  const roleLabel = role ? t(lang, role === "admin" ? strings.usuarios.role_admin : strings.usuarios.role_user) : null;

  return (
    <DropdownMenu onOpenChange={(o) => !o && setArmSignOut(false)}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={user.name}
          aria-label={t(lang, strings.nav.profile)}
          className="flex size-11 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
        >
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
            <img src={user.picture} alt="" className="size-8 rounded-full border border-sidebar-border" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-[13px] font-bold text-sidebar-primary-foreground">
              {initial}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          {roleLabel && <span className="text-xs text-muted-foreground">{roleLabel}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Formularios de JotForm (según permiso). */}
        {visibleQuickLinks({ role, modules }).length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t(lang, strings.nav.forms)}</DropdownMenuLabel>
            {visibleQuickLinks({ role, modules }).map((f) => {
              const Icon = f.icon;
              return f.action === "share" ? (
                <DropdownMenuItem
                  key={f.key}
                  onSelect={() =>
                    void shareLink(f.href, t(lang, strings.nav.form_registro_share_text), t(lang, f.label)).then(
                      (r) => r === "copied" && toast.success(t(lang, strings.nav.link_copied)),
                    )
                  }
                >
                  <Icon className="size-3.5" />
                  <span className="flex-1">{t(lang, f.label)}</span>
                  <Share2 className="size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={f.key} asChild>
                  <a href={f.href} target="_blank" rel="noreferrer">
                    <Icon className="size-3.5" />
                    {t(lang, f.label)}
                  </a>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t(lang, strings.nav.theme)}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <DropdownMenuRadioItem key={value} value={value} onSelect={(e) => e.preventDefault()}>
              <Icon className="size-3.5" />
              {t(lang, strings.nav[label])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* onSelect sin cerrar el menú: se ve el cambio de idioma al instante. */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggle();
          }}
        >
          <Languages className="size-3.5" />
          <span className="flex-1">{t(lang, strings.nav.language)}</span>
          <span className="text-xs font-semibold text-muted-foreground">{lang.toUpperCase()}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className={armSignOut ? "font-semibold" : undefined}
          onSelect={(e) => {
            if (!armSignOut) {
              e.preventDefault();
              setArmSignOut(true);
              return;
            }
            void signOut();
          }}
        >
          <LogOut className="size-3.5" />
          {armSignOut ? t(lang, strings.nav.confirm_signout) : t(lang, strings.auth.signOut)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
