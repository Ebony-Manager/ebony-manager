"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

import { breadcrumbFor } from "@/components/layout/nav-items";
import { useLang } from "@/context/language-context";

/** "Personal / Pagos" arriba de la pantalla, sacado del menú (ver `breadcrumbFor`). */
export function PageBreadcrumb() {
  const { lang } = useLang();
  const crumbs = breadcrumbFor(usePathname(), lang);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="-mt-2 flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-900/30">/</span>}
            <span className={isLast ? "font-semibold text-ink-900" : "text-ink-900/50"}>{crumb}</span>
          </span>
        );
      })}
    </nav>
  );
}

/** Selector de opciones en pastilla (Todos / Taller / Administrativo…). */
/**
 * Control segmentado para FILTRAR lo que se ve (Todos / Empleados /
 * Contratistas…): fondo gris y la opción elegida en blanco, sin el azul de
 * la marca. Así no se confunde con las pestañas que llevan a otra pantalla
 * (arriba, subrayadas). Con `fill`, en el celular ocupa todo el ancho y
 * reparte las opciones por igual.
 */
export function SegmentedFilter<T extends string>({
  value,
  options,
  onChange,
  fill = false,
  className,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn(
        "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        fill && "w-full sm:w-auto",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-[13px] py-1.5 text-[12.5px] whitespace-nowrap transition-colors",
            fill && "flex-1 sm:flex-none",
            value === o.value ? "bg-card font-semibold text-foreground shadow-sm" : "font-medium text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
