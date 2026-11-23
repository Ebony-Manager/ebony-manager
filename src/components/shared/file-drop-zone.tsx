"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Zona para arrastrar un archivo (o tocar y elegirlo): la misma en todas las pantallas que suben un documento
 * (ver UI-RULES.md). En el teléfono, tocarla abre el selector de archivos.
 */
export function FileDropZone({
  onFiles,
  label,
  hint,
  multiple = false,
  accept,
  disabled = false,
  busy = false,
  busyLabel,
  className,
}: {
  onFiles: (files: File[]) => void;
  /** Ej. «Arrastra aquí la hoja de medidas o toca para elegirla». */
  label: string;
  hint?: string;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  /** Mientras sube: se ve el texto de `busyLabel` y no recibe más. */
  busy?: boolean;
  busyLabel?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const off = disabled || busy;
  const take = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!off && files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      role="button"
      tabIndex={off ? -1 : 0}
      aria-disabled={off || undefined}
      onClick={() => !off && ref.current?.click()}
      onKeyDown={(e) => {
        if (!off && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          ref.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!off) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        // ui-allow: dropzone (zona para arrastrar archivos, no un vacío)
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
        over ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40",
        off && "cursor-default opacity-60",
        className,
      )}
    >
      <input
        ref={ref}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <Upload className={cn("size-5", over ? "text-primary" : "text-muted-foreground")} />
      <p className="text-sm font-medium text-foreground">{busy && busyLabel ? busyLabel : label}</p>
      {hint && !busy && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
