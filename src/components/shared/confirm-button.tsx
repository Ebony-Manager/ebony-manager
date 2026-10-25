"use client";

import * as React from "react";
import { Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Borrar o vaciar en dos toques, para no perder nada por un toque sin querer
 * (sobre todo en el celular): el primero cambia el botón a rojo con la
 * pregunta ("¿Vaciar todo?", "¿Quitar?"), el segundo hace la acción. Si no
 * se toca de nuevo en 3 segundos, vuelve a la normalidad.
 *
 * - Con texto (`label`): un botón chico con ícono y texto.
 * - `iconOnly`: solo el ícono (ej. la X de una línea); al armarse muestra la
 *   pregunta en una pastilla roja.
 */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  icon: Icon = Trash2,
  iconOnly = false,
  className,
  iconClassName,
  disabled,
}: {
  onConfirm: () => void;
  label: string;
  confirmLabel: string;
  icon?: LucideIcon;
  iconOnly?: boolean;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!armed) return setArmed(true);
    setArmed(false);
    onConfirm();
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={armed ? confirmLabel : label}
        title={armed ? confirmLabel : label}
        onClick={onClick}
        className={cn(
          armed
            ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white"
            : "inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-40",
          className,
        )}
      >
        {armed ? (
          <>
            <Icon className="size-3" />
            {confirmLabel}
          </>
        ) : (
          <Icon className={cn("size-3.5", iconClassName)} />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={armed ? "destructive" : "outline"}
      size="sm"
      disabled={disabled}
      className={cn("h-9 whitespace-nowrap", className)}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
      {armed ? confirmLabel : label}
    </Button>
  );
}
