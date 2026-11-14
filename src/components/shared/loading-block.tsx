"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * El ÚNICO "cargando" de la app (ver UI-RULES.md): barras grises con la forma aproximada de lo que va a
 * aparecer, para que el contenido no salte cuando llegan los datos. Nunca un texto suelto «Cargando…».
 *  - `lines` (por defecto): un bloque de texto o una lista corta.
 *  - `cards`: una fila de tarjetas (KPI, prestaciones).
 *  - `table`: encabezado y filas de una tabla.
 * `size="page"` para cuando es toda la vista. Los lectores de pantalla oyen «Cargando».
 */
export function LoadingBlock({
  variant = "lines",
  rows,
  size = "block",
  className,
}: {
  variant?: "lines" | "cards" | "table";
  rows?: number;
  size?: "block" | "page";
  className?: string;
}) {
  const { lang } = useLang();
  const n = rows ?? (variant === "cards" ? 3 : variant === "table" ? 5 : 3);
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-2", size === "page" ? "py-6" : "py-1", className)}>
      <span className="sr-only">{t(lang, strings.common.loading)}</span>
      {variant === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: n }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : variant === "table" ? (
        <>
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: n }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </>
      ) : (
        Array.from({ length: n }, (_, i) => <Skeleton key={i} className={cn("h-4", i === n - 1 ? "w-2/3" : "w-full")} />)
      )}
    </div>
  );
}
