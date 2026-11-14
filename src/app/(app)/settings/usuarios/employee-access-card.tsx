"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { AppUser } from "@/types/usuarios";
import { RemoveUserDialog } from "./remove-user-dialog";

/**
 * Aviso de seguridad en el encabezado de la ficha de una persona de Personal (solo lo ve el administrador):
 * si la persona está inactiva y todavía tiene acceso a la app, lo dice y deja quitárselo ahí mismo. En
 * cualquier otro caso no muestra nada: el acceso normal (dar / ver) vive en el menú de la tuerca de la ficha.
 */
export function EmployeeAccessWarning({ access, active }: { access: AppUser | null | undefined; active: boolean }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const [removing, setRemoving] = React.useState(false);

  if (!access || active) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        {tt("access_warn")}
      </p>
      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRemoving(true)}>
        {tt("access_remove")}
      </Button>
      <RemoveUserDialog user={access} open={removing} onOpenChange={setRemoving} />
    </div>
  );
}
