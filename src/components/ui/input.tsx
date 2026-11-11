import * as React from "react";

import { cn } from "@/lib/utils";

/** Fecha y hora: el navegador les da un ancho propio (sobre todo el iPhone) y se salían de su columna. */
const NATIVE_PICKER = new Set(["date", "time", "datetime-local", "month", "week"]);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        type && NATIVE_PICKER.has(type) && "block min-h-9 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:min-h-[1.25rem] [&::-webkit-date-and-time-value]:text-left",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
