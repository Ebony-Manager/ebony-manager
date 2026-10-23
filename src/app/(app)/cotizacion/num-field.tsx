"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function show(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 10000) / 10000);
}

/**
 * Casilla de número con su unidad adentro ("$" antes; "m", "%", "u"
 * después). Al entrar queda todo seleccionado, así se escribe encima sin
 * tener que borrar antes. Acepta coma o punto decimal.
 *
 * `locked` la muestra como valor fijo (sin borde ni edición): es como se
 * ven los márgenes de la empresa hasta que se pulsa "Editar".
 */
export function NumField({
  value,
  onChange,
  onCommit,
  prefix,
  suffix,
  locked = false,
  inputWidth = 44,
  className,
  autoFocus,
  ...aria
}: {
  value: number;
  onChange: (n: number) => void;
  /** Se llama al salir de la casilla (para guardar una sola vez). */
  onCommit?: () => void;
  prefix?: string;
  suffix?: string;
  locked?: boolean;
  inputWidth?: number;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  title?: string;
  id?: string;
}) {
  // Mientras se escribe se conserva el texto tal cual ("4." o "4,1"); al
  // salir se vuelve a mostrar el número guardado.
  const [text, setText] = React.useState<string | null>(null);
  const justFocused = React.useRef(false);

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-[3px] whitespace-nowrap",
        locked ? "" : "border border-input bg-card px-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
        className
      )}
    >
      {prefix && <span className="text-[11px] text-muted-foreground">{prefix}</span>}
      <input
        {...aria}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={locked}
        value={text ?? show(value)}
        style={{ width: inputWidth }}
        className={cn(
          "min-w-0 bg-transparent p-0 text-right text-[13px] tabular-nums outline-none",
          locked && "font-semibold text-foreground disabled:opacity-100"
        )}
        onFocus={(e) => {
          e.currentTarget.select();
          justFocused.current = true;
        }}
        onMouseUp={(e) => {
          // El clic que enfocó la casilla no debe deshacer la selección
          // (pasa en Safari y Chrome): así lo que se escribe reemplaza.
          if (justFocused.current) e.preventDefault();
          justFocused.current = false;
        }}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setText(raw);
          const n = parseFloat(raw.replace(",", "."));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        onBlur={() => {
          setText(null);
          onCommit?.();
        }}
      />
      {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
    </span>
  );
}
