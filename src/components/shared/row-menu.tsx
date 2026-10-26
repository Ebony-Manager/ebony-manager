"use client";

import * as React from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface RowMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Borrar y similares: el primer toque cambia el texto a la pregunta (en
   *  rojo) y el menú sigue abierto; el segundo toque lo hace. */
  confirmLabel?: string;
}

/**
 * El "⋯" de una fila (cotizaciones, etc.): las acciones poco usadas van
 * adentro en vez de íconos sueltos en cada fila. Borrar pide un segundo
 * toque dentro del mismo menú.
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [armed, setArmed] = React.useState<string | null>(null);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setArmed(null)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={label} title={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => {
          const Icon = item.icon;
          const isArmed = armed === item.label;
          return (
            <DropdownMenuItem
              key={item.label}
              disabled={item.disabled}
              variant={item.confirmLabel ? "destructive" : "default"}
              className={isArmed ? "font-semibold" : undefined}
              onSelect={(e) => {
                if (item.confirmLabel && !isArmed) {
                  e.preventDefault();
                  setArmed(item.label);
                  return;
                }
                item.onSelect();
              }}
            >
              <Icon className="size-3.5" />
              {isArmed ? item.confirmLabel : item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
