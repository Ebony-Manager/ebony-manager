"use client";

import { Languages, LogOut } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Acceso al perfil, abajo a la izquierda del rail (antes vivía en la barra
 * superior, que ya no existe): la foto o inicial abre un menú con nombre,
 * correo y rol, el cambio de idioma y cerrar sesión.
 */
export function UserMenu() {
  const { user, role, signOut } = useAuth();
  const { lang, toggle } = useLang();
  if (!user) return null;

  const initial = user.name?.[0]?.toUpperCase();
  const roleLabel = role ? t(lang, role === "admin" ? strings.usuarios.role_admin : strings.usuarios.role_user) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={user.name}
          aria-label={t(lang, strings.nav.profile)}
          className="flex size-11 items-center justify-center rounded-[11px] transition-colors hover:bg-white/10 data-[state=open]:bg-white/20"
        >
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
            <img src={user.picture} alt="" className="size-8 rounded-full border border-white/30" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold text-white">
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
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="size-3.5" />
          {t(lang, strings.auth.signOut)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
