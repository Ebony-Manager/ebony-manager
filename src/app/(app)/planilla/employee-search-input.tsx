"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Buscador de empleado compartido por Registro y Auditoría: escribes un
 * nombre y la tabla se queda solo con ese empleado. Esc o la X limpian.
 */
export function EmployeeSearchInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Por defecto "Buscar empleado…"; Staff busca también contratistas. */
  placeholder?: string;
}) {
  const { lang } = useLang();
  const clearLabel = t(lang, strings.planilla.emp_search_clear);
  const ph = placeholder ?? t(lang, strings.planilla.emp_search_ph);
  return (
    <div className={`relative ${className ?? "w-52"}`}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder={ph}
        aria-label={ph}
        className="h-8 pr-7 pl-8 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
