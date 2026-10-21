"use client";

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
export function SegmentedFilter<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            value === o.value
              ? "rounded-md bg-primary px-[13px] py-1.5 text-[12.5px] font-semibold text-primary-foreground"
              : "rounded-md px-[13px] py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
