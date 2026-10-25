"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

interface Ask {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}

/**
 * Pregunta antes de algo que cambia mucho (marcar una quincena pagada,
 * reabrirla, dejar en 0 la asistencia), con la explicación de lo que pasa,
 * en una ventana de la app en vez del cuadro gris del navegador. Para
 * borrar o quitar una sola cosa se usa ConfirmButton (dos toques).
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title, message, confirmLabel }))) return;
 *   …y renderizar {dialog}.
 */
export function useConfirm() {
  const { lang } = useLang();
  const [ask, setAsk] = React.useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = React.useCallback((a: Ask) => new Promise<boolean>((resolve) => setAsk({ ...a, resolve })), []);
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  const dialog = (
    <Dialog open={ask !== null} onOpenChange={(o) => !o && close(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{ask?.title}</DialogTitle>
          <DialogDescription>{ask?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {t(lang, strings.nav.confirm_back)}
          </Button>
          <Button variant={ask?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
            {ask?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
