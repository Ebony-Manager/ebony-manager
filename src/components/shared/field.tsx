"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Lo que el campo le pasa al control que lleva adentro (Input, Textarea, Select, pickers). */
export interface FieldContextValue {
  id: string;
  icon?: LucideIcon;
  invalid: boolean;
  required: boolean;
  describedBy?: string;
}
const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Para los controles: el campo en el que están, si lo hay. */
export function useField(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

/**
 * El campo de TODOS los formularios (ver UI-RULES.md): título arriba, el
 * control abajo y, si falla, el mensaje debajo.
 *
 * - `required`: asterisco junto al título. Lo opcional no se marca.
 * - `icon`: ícono tenue DENTRO del control (`ICON.owner`, `ICON.date`…); el
 *   título queda limpio. Solo si el concepto está en `lib/ui/concepts.ts`.
 * - `error`: el control se marca en rojo y el mensaje sale debajo. `invalid`
 *   marca sin mensaje (cuando el mensaje lo da el grupo: "al menos uno").
 * - `hint`: ayuda corta debajo (solo si hace falta).
 * - Un control por campo. `min-w-0` es a propósito: dentro de una cuadrícula,
 *   sin él una fecha empuja la columna y se sale de su recuadro.
 */
export function Field({
  label,
  hint,
  required = false,
  error,
  invalid = false,
  icon,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  invalid?: boolean;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const bad = invalid || !!error;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <FieldContext.Provider value={{ id, icon, invalid: bad, required, describedBy: errorId }}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden>
              {" "}
              *
            </span>
          )}
        </Label>
        {children}
        {error && (
          <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-destructive">
            <CircleAlert className="size-3.5 shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </FieldContext.Provider>
  );
}
