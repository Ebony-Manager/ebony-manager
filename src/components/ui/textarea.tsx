"use client";

import * as React from "react";

import { useField } from "@/components/shared/field";
import { cn } from "@/lib/utils";

function Textarea({ className, id, ...props }: React.ComponentProps<"textarea">) {
  const field = useField();
  // Sin ícono: el título de arriba basta (UI-RULES §2).
  return (
    <textarea
      id={id ?? field?.id}
      data-slot="textarea"
      aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
      aria-required={props["aria-required"] ?? (field?.required || undefined)}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
