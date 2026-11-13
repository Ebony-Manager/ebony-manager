"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, KeyRound, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { AccessCandidate, AppUser } from "@/types/usuarios";
import { RemoveUserDialog } from "./remove-user-dialog";
import { UserFormDialog } from "./user-form-dialog";

/**
 * "Acceso a la app" en la ficha de una persona de Personal (solo la ve el administrador): si ya es
 * usuario, con su rol y estado; si no, el botón para darle acceso con sus datos ya puestos. Si la
 * persona está inactiva y todavía tiene acceso, avisa y deja quitárselo ahí mismo.
 */
export function EmployeeAccessCard({ person, access }: { person: AccessCandidate; access: AppUser | null }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const [giving, setGiving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="size-4 text-muted-foreground" />
          {tt("access_title")}
        </h2>
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

      {access ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={access.role === "admin" ? "default" : "outline"}>{access.role === "admin" ? tt("role_admin") : tt("role_user")}</Badge>
          {access.lastSignInAt ? <Badge variant="success">{tt("status_active")}</Badge> : <Badge variant="warning">{tt("status_pending")}</Badge>}
          <span className="text-xs text-muted-foreground">{access.email}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{tt("access_none")}</p>
      )}

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
    </Card>
  );
}
