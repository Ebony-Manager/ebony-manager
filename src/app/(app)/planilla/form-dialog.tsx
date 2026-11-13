"use client";

import * as React from "react";

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
import { useDiscardGuard } from "@/components/shared/discard-guard";

/** Diálogo de formulario simple para el módulo Planilla — reemplaza el
 *  `@/components/shared/form-dialog` de Atlas sin sumar dependencias
 *  (react-hook-form/zod). El contenido son inputs controlados; este
 *  componente solo da el marco (título, descripción, footer, submit). */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel,
  error,
  dirty,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  submitLabel: string;
  /** Obsoleto: usa `useFormErrors` + `<Field error>`; esto es solo para los que aún no migran. */
  error?: string | null;
  /** ¿Hay cosas escritas sin guardar? Si sí, cerrar pregunta «¿Descartar los cambios?». */
  dirty?: () => boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { lang } = useLang();
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => dirty?.() ?? false, () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${wide ? "max-w-xl" : "max-w-md"}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          {children}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>
              {t(lang, strings.planilla.action_cancel)}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t(lang, strings.planilla.saving) : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}

// El campo etiquetado vive en components/shared/field.tsx (uno solo para toda la app).
export { Field } from "@/components/shared/field";
