"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, KeyRound, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { AccessCandidate, AppUser } from "@/types/usuarios";
import { RemoveUserDialog } from "./remove-user-dialog";
import { UserFormDialog } from "./user-form-dialog";

/**
 * "Acceso a la app" en el encabezado de la ficha de una persona de Personal (solo lo ve el administrador): una
 * línea con su rol y estado y el enlace a Usuarios, o «sin acceso» con el botón para darlo (con sus datos ya
 * puestos). Si la persona está inactiva y todavía tiene acceso, avisa y deja quitárselo ahí mismo.
 */
export function EmployeeAccessLine({ person, access }: { person: AccessCandidate; access: AppUser | null }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const [giving, setGiving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{tt("access_title")}</span>
          {access ? (
            <>
              <Badge variant={access.role === "admin" ? "default" : "outline"}>{access.role === "admin" ? tt("role_admin") : tt("role_user")}</Badge>
              {access.lastSignInAt ? <Badge variant="success">{tt("status_active")}</Badge> : <Badge variant="warning">{tt("status_pending")}</Badge>}
            </>
          ) : (
            <span className="text-muted-foreground">· {tt("access_none_short")}</span>
          )}
        </div>
        {access ? (
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Link href="/settings/usuarios">{tt("access_manage")}</Link>
          </Button>
        ) : (
          person.active && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setGiving(true)}>
              <UserPlus className="size-3.5" />
              {tt("access_give")}
            </Button>
          )
        )}
      </div>

      {access && !person.active && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {tt("access_warn")}
          </p>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRemoving(true)}>
            {tt("access_remove")}
          </Button>
        </div>
      )}

      <UserFormDialog open={giving} onOpenChange={setGiving} prefill={person} />
      {access && <RemoveUserDialog user={access} open={removing} onOpenChange={setRemoving} />}
    </div>
  );
}
