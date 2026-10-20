"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { MailPlus, MoreHorizontal, Pencil, Send, UserMinus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { breadcrumbFor } from "@/components/layout/nav-items";
import { useLang } from "@/context/language-context";
import { t, strings, type Lang } from "@/lib/i18n";
import { formatDateCompact } from "@/lib/planilla/format";
import type { AppUser } from "@/types/usuarios";
import { resendInvitationAction } from "./actions";
import { MODULE_LABELS } from "./module-labels";
import { RemoveUserDialog } from "./remove-user-dialog";
import { UserFormDialog } from "./user-form-dialog";

function shortDate(lang: Lang, iso: string | null): string {
  return iso ? formatDateCompact(lang, iso.slice(0, 10)) : "";
}

/**
 * Administración → Usuarios: la lista de quién entra a la app, con su rol,
 * sus módulos y si ya aceptó la invitación. Desde acá se invita (por
 * correo), se cambian permisos, se reenvía la invitación y se quita el
 * acceso. Los datos vienen del servidor; tras cada cambio, router.refresh().
 */
export function UsuariosClient({ users, myEmail }: { users: AppUser[]; myEmail: string }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname, lang);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AppUser | null>(null);
  const [removing, setRemoving] = React.useState<AppUser | null>(null);

  const isMe = (u: AppUser) => u.email.toLowerCase() === myEmail.toLowerCase();

  async function resend(u: AppUser) {
    const res = await resendInvitationAction(u.email);
    if (res.ok) toast.success(tt("resent"));
    else toast.error(res.error, { duration: 8000 });
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      {crumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="-mt-2 flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-900/30">/</span>}
                <span className={isLast ? "font-semibold text-ink-900" : "text-ink-900/50"}>{crumb}</span>
              </span>
            );
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{tt("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <MailPlus className="size-3.5" />
          {tt("invite")}
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/15 bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {tt("empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-900/8 bg-card">
          {/* Encabezado: solo en pantallas anchas; en el celular cada usuario es una tarjeta. */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.3fr)_40px] gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground md:grid">
            <span>{tt("col_user")}</span>
            <span>{tt("col_role")}</span>
            <span>{tt("col_modules")}</span>
            <span>{tt("col_status")}</span>
            <span />
          </div>

          <ul className="divide-y divide-border">
            {users.map((u) => {
              const me = isMe(u);
              const active = Boolean(u.lastSignInAt);
              const display = u.fullName || u.email;
              return (
                <li
                  key={u.email}
                  className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.3fr)_40px]"
                >
                  {/* Usuario */}
                  <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local/optimizable asset
                      <img src={u.avatarUrl} alt="" className="size-8 shrink-0 rounded-full border border-ink-900/15" />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-walnut text-[12px] font-bold text-white">
                        {display[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-900">
                        <span className="truncate">{display}</span>
                        {me && <span className="shrink-0 text-xs font-normal text-muted-foreground">({tt("you")})</span>}
                      </div>
                      {u.fullName && <div className="truncate text-xs text-muted-foreground">{u.email}</div>}
                      {u.note && <div className="truncate text-xs text-muted-foreground">{u.note}</div>}
                    </div>
                  </div>

                  {/* Acciones (en el celular, a la derecha del nombre) */}
                  <div className="col-start-2 row-start-1 flex justify-end md:col-start-5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={tt("more_actions")} title={tt("more_actions")}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(u)}>
                          <Pencil className="size-3.5" />
                          {tt("edit")}
                        </DropdownMenuItem>
                        {!active && (
                          <DropdownMenuItem onSelect={() => void resend(u)}>
                            <Send className="size-3.5" />
                            {tt("resend")}
                          </DropdownMenuItem>
                        )}
                        {!me && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoving(u)}>
                              <UserMinus className="size-3.5" />
                              {tt("remove")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Rol */}
                  <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1">
                    <Badge variant={u.role === "admin" ? "default" : "outline"}>
                      {u.role === "admin" ? tt("role_admin") : tt("role_user")}
                    </Badge>
                  </div>

                  {/* Módulos */}
                  <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:col-start-3 md:row-start-1">
                    {u.role === "admin" ? (
                      <span className="text-xs text-muted-foreground">{tt("all_modules")}</span>
                    ) : u.modules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{tt("no_modules")}</span>
                    ) : (
                      u.modules.map((m) => (
                        <Badge key={m} variant="secondary" className="font-normal">
                          {t(lang, MODULE_LABELS[m].label)}
                        </Badge>
                      ))
                    )}
                  </div>

                  {/* Estado */}
                  <div className="col-span-2 text-xs md:col-span-1 md:col-start-4 md:row-start-1">
                    {active ? (
                      <>
                        <Badge variant="success">{tt("status_active")}</Badge>
                        <div className="mt-1 text-muted-foreground">
                          {tt("last_sign_in")}: {shortDate(lang, u.lastSignInAt)}
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge variant="warning">{tt("status_pending")}</Badge>
                        {u.invitedAt && (
                          <div className="mt-1 text-muted-foreground">
                            {tt("invited_on")}: {shortDate(lang, u.invitedAt)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <UserFormDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      {editing && (
        <UserFormDialog
          user={editing}
          isSelf={isMe(editing)}
          open={Boolean(editing)}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {removing && <RemoveUserDialog user={removing} open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} />}
    </div>
  );
}
