"use client";

import * as React from "react";

import { useField } from "@/components/shared/field";
import { cn } from "@/lib/utils";

/** Fecha y hora: el navegador les da un ancho propio (sobre todo el iPhone) y se salían de su columna. */
const NATIVE_PICKER = new Set(["date", "time", "datetime-local", "month", "week"]);

function Input({ className, type, id, ...props }: React.ComponentProps<"input">) {
  const field = useField();
  const Icon = type === "file" || type === "checkbox" || type === "radio" || type === "hidden" ? undefined : field?.icon;
  const control = (
    <input
      type={type}
      id={id ?? field?.id}
      data-slot="input"
      aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
      aria-required={props["aria-required"] ?? (field?.required || undefined)}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        type && NATIVE_PICKER.has(type) && "block min-h-9 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:min-h-[1.25rem] [&::-webkit-date-and-time-value]:text-left",
        Icon && "pl-9",
        className,
      )}
      {...props}
    />
  );
  if (!Icon) return control;
  return (
    <div className="relative w-full min-w-0">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      {control}
    </div>
  );
}

export { Input };
