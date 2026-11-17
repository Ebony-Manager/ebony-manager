"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import type { AppUser } from "@/types/usuarios";
import { deleteUserAction } from "./actions";

/** Confirmación para quitarle el acceso a alguien (se le puede volver a invitar). */
export function RemoveUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.usuarios) => t(lang, strings.usuarios[k]);
  const [submitting, setSubmitting] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setSubmitting(false);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onConfirm() {
    setSubmitting(true);
    const res = await deleteUserAction(user.email);
    if (!res.ok) {
      toast.error(res.error);
      setSubmitting(false);
      return;
    }
    toast.success(tt("removed"));
    // La acción ya hace revalidatePath de Usuarios: sin router.refresh().
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            {tt("del_title")}
          </DialogTitle>
          <DialogDescription>{user.fullName ? `${user.fullName} · ${user.email}` : user.email}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          {tt("del_desc")}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tt("cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirm()} disabled={submitting}>
            {submitting ? tt("saving") : tt("del_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
