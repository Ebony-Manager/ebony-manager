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
  error?: string | null;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { lang } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t(lang, strings.planilla.action_cancel)}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t(lang, strings.planilla.saving) : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// El campo etiquetado vive en components/shared/field.tsx (uno solo para toda la app).
export { Field } from "@/components/shared/field";
