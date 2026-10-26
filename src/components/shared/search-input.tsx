"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * El buscador de todas las listas de la app (Staff, Almacén, Cotizaciones,
 * Proyectos…), con un solo aspecto: el de los campos del tema (esquinas
 * redondeadas), lupa a la izquierda y una X para borrar lo escrito (Esc
 * también lo borra). El ancho lo decide quien lo usa con `className`.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const { lang } = useLang();
  const clear = t(lang, strings.planilla.emp_search_clear);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 bg-card pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clear}
          title={clear}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Barra de búsqueda y filtros de una lista. En el celular se queda pegada
 * arriba al bajar (con fondo, de borde a borde), para poder buscar sin volver
 * al inicio. En computadora es una fila normal.
 */
export function ListToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // Mismo margen que las pantallas (px-4 / sm:px-7), para ir de borde a borde.
        "sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-7 sm:gap-3 sm:px-7",
        "md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
