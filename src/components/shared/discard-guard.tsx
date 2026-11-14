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
/**
 * Cómo estaba el formulario al abrirlo, para saber si hubo cambios (y solo entonces preguntar al cerrar).
 *
 *   const { isDirty, markSeeded } = useFormBaseline(snapshot, ready);
 *   // en el efecto que llena el formulario al abrir (dentro de él): markSeeded();
 *   // ready = false mientras llegan datos que también cambian el formulario (piezas guardadas…)
 *   useDiscardGuard(isDirty, onClose)
 *
 * La foto de "cómo estaba" se toma en la pasada SIGUIENTE a la que llenó el formulario, cuando el estado ya
 * trae los datos (si se tomara en la misma pasada, vería el estado de antes y todo parecería un cambio).
 * Hasta que se toma, no cuenta como cambiado.
 */
export function useFormBaseline(snapshot: () => string, ready = true) {
  const latest = React.useRef(snapshot);
  const baseline = React.useRef<string | null>(null);
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    latest.current = snapshot;
  });
  React.useEffect(() => {
    if (epoch > 0 && ready) baseline.current = latest.current();
  }, [epoch, ready]);
  const markSeeded = React.useCallback(() => {
    baseline.current = null;
    setEpoch((e) => e + 1);
  }, []);
  const isDirty = React.useCallback(() => baseline.current !== null && latest.current() !== baseline.current, []);
  return { isDirty, markSeeded };
}

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
