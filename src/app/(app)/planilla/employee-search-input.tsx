"use client";

import { SearchInput } from "@/components/shared/search-input";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";

/**
 * Buscador de empleado compartido por Registro, Auditoría y Staff: escribes
 * un nombre y la lista se queda solo con esa persona. Es el buscador de toda
 * la app (SearchInput) con el texto "Buscar empleado…" por defecto.
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
  return <SearchInput value={value} onChange={onChange} placeholder={placeholder ?? t(lang, strings.planilla.emp_search_ph)} className={className ?? "w-52"} />;
}
