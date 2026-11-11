import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * El campo etiquetado de TODOS los formularios: título chico y tenue arriba,
 * el control abajo, ayuda opcional debajo. Es el único: no se definen otros
 * `Field` locales (ver UI-RULES.md).
 *
 * `min-w-0` es a propósito: dentro de una cuadrícula, sin él un campo de
 * fecha (que en el iPhone tiene un ancho propio) empuja la columna y se sale
 * de su recuadro.
 */
export function Field({
  label,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: string;
  /** "opcional" al lado del título (en vez de escribirlo dentro del campo). */
  optional?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground">
        {label}
        {optional && <span className="font-normal opacity-70">· {optional}</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
