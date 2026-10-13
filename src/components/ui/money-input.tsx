"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Campo de monto en dólares: lleva el "$" adelante, no tiene flechitas, solo
 * deja escribir números y un punto decimal, y al entrar selecciona todo lo que
 * hay para que escribir reemplace el valor (sin tener que borrar a mano).
 * El valor es el texto tal cual ("12.50"); quien lo usa lo convierte.
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  placeholder = "0.00",
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={(e) => {
          e.currentTarget.select();
          props.onFocus?.(e);
        }}
        onChange={(e) => {
          // Solo dígitos y un punto; una coma de teclado numérico cuenta como punto.
          const cleaned = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          const [int, ...rest] = cleaned.split(".");
          onValueChange(rest.length > 0 ? `${int}.${rest.join("")}` : int);
        }}
        className={cn("pl-6 text-right tabular-nums", className)}
      />
    </div>
  );
}
