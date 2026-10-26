"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import type { InspectionPhoto } from "@/types/inspections";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type InspeccionesKey = keyof typeof strings.inspecciones;

/** Textos de Inspecciones en el idioma actual, con {n} / {date} reemplazados. */
export function useTi() {
  const { lang } = useLang();
  const ti = React.useCallback(
    (k: InspeccionesKey, vars?: Record<string, string | number>) => {
      let s = t(lang, strings.inspecciones[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { ti, lang };
}

/** Miniatura cuadrada de una foto (o un ícono si no se pudo firmar). */
export function PhotoThumb({ photo, onClick, className }: { photo: InspectionPhoto; onClick?: () => void; className?: string }) {
  const { ti } = useTi();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:size-24", className)}
    >
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada del bucket privado
        <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff className="m-auto size-5 text-muted-foreground" />
      )}
      {photo.kind === "despues" && (
        <span className="absolute inset-x-0 bottom-0 bg-success/90 py-0.5 text-center text-[10px] font-semibold text-white">{ti("photo_after")}</span>
      )}
    </button>
  );
}

/** Las fotos en grande, con flechas (y teclado) para pasar de una a otra. */
export function PhotoViewer({ photos, index, onIndex }: { photos: InspectionPhoto[]; index: number | null; onIndex: (i: number | null) => void }) {
  const { ti } = useTi();
  const open = index !== null && !!photos[index];
  const go = React.useCallback(
    (d: number) => index !== null && photos.length > 1 && onIndex((index + d + photos.length) % photos.length),
    [index, photos.length, onIndex],
  );
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);
  const photo = open ? photos[index] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent className="max-w-3xl gap-2 p-2 sm:p-3">
        <DialogTitle className="sr-only">{ti("f_photos")}</DialogTitle>
        {photo?.url && (
          <div className="relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada del bucket privado */}
            <img src={photo.url} alt="" className="max-h-[78vh] w-auto rounded-md object-contain" />
            {photo.kind === "despues" && (
              <span className="absolute top-2 left-2 rounded bg-success px-2 py-0.5 text-xs font-semibold text-white">{ti("photo_after")}</span>
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={ti("photo_prev")}
                  className="absolute left-1 flex size-10 items-center justify-center rounded-full bg-black/45 text-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={ti("photo_next")}
                  className="absolute right-1 flex size-10 items-center justify-center rounded-full bg-black/45 text-white"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
        )}
        {photos.length > 1 && index !== null && (
          <p className="text-center text-xs text-muted-foreground tabular-nums">
            {index + 1} / {photos.length}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
