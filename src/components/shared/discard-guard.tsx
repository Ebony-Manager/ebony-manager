"use client";

import * as React from "react";

import { useConfirm } from "@/components/shared/confirm-dialog";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Antes de cerrar un formulario con cosas escritas (ver UI-RULES.md): pregunta
 * "¿descartar los cambios?". En el teléfono un toque afuera, o la tecla Atrás,
 * borraba todo sin avisar.
 *
 *   const { requestClose, dialog } = useDiscardGuard(() => isDirty, onClose);
 *   <Dialog onOpenChange={(o) => !o && requestClose()}> … <Button onClick={requestClose}>Cancelar</Button> … {dialog}
 *
 * Al GUARDAR bien se llama `onClose` directo (sin preguntar).
 */
export function useDiscardGuard(isDirty: () => boolean, onClose: () => void) {
  const { lang } = useLang();
  const { confirm, dialog } = useConfirm();
  const requestClose = React.useCallback(async () => {
    if (!isDirty()) return onClose();
    const ok = await confirm({
      title: t(lang, strings.nav.discard_title),
      message: t(lang, strings.nav.discard_message),
      confirmLabel: t(lang, strings.nav.discard_confirm),
      destructive: true,
    });
    if (ok) onClose();
  }, [isDirty, onClose, confirm, lang]);
  return { requestClose, dialog };
}
