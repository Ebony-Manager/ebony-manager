"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { breadcrumbFor } from "@/components/layout/nav-items";
import { useLang } from "@/context/language-context";
import { cn } from "@/lib/utils";

// Piezas comunes para que todas las pantallas se vean y se ordenen igual:
// márgenes, título con su acción a la derecha, subtítulos de sección,
// selectores con flechas y el recuadro de "no hay nada".

/** Márgenes y separación de cualquier pantalla del área protegida. */
export const PAGE_CLASS = "flex flex-col gap-5 px-4 pt-4 pb-10 sm:px-7 sm:pt-6";

/**
 * Encabezado de pantalla: (en computadora) la ruta "Personal / Pagos"
 * chiquita arriba, el título, la explicación (solo en computadora) y la
 * acción principal a la derecha, en la misma línea del título también en
 * el celular. `back` pone un "← Volver a …" encima (fichas y subpantallas).
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  action,
  back,
  crumbs = true,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Dato corto al lado del título (ej. "12 activos"). */
  meta?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
  /** Mostrar la ruta del menú encima (computadora). */
  crumbs?: boolean;
  className?: string;
}) {
  const { lang } = useLang();
  const path = breadcrumbFor(usePathname(), lang);
  const showCrumbs = crumbs && !back && path.length > 1;
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        {back && <BackLink href={back.href} label={back.label} className="mb-1" />}
        {showCrumbs && <p className="mb-0.5 hidden text-xs text-muted-foreground md:block">{path.slice(0, -1).join(" / ")}</p>}
        <h1 className="flex flex-wrap items-center gap-x-2 text-xl font-semibold text-foreground">
          {title}
          {meta && <span className="text-sm font-normal text-muted-foreground">{meta}</span>}
        </h1>
        {subtitle && <p className="hidden max-w-2xl text-sm text-muted-foreground sm:block">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** "← Volver" arriba de las fichas y subpantallas: el mismo en todas. */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn("-ml-2 self-start text-muted-foreground", className)}>
      <Link href={href}>
        <ArrowLeft className="size-3.5" />
        {label}
      </Link>
    </Button>
  );
}

/** Título de una sección dentro de una pantalla, con sus controles a la derecha. */
export function SectionHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="hidden text-xs text-muted-foreground sm:block">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Selector con flechas (quincena, mes, año): el mismo en todas partes.
 * Con `fill`, en el celular ocupa todo el ancho y las flechas quedan en los
 * extremos, fáciles de tocar.
 */
export function Stepper({
  label,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  fill = false,
  className,
}: {
  label: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border bg-card px-1", fill && "w-full sm:w-auto", className)}>
      <Button variant="ghost" size="icon" className="size-8 sm:size-7" onClick={onPrev} disabled={prevDisabled}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className={cn("min-w-0 truncate px-1 text-center text-sm font-medium text-foreground", fill && "flex-1 sm:min-w-52 sm:flex-none")}>
        {label}
      </span>
      <Button variant="ghost" size="icon" className="size-8 sm:size-7" onClick={onNext} disabled={nextDisabled}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

/** El recuadro punteado de "todavía no hay nada" / "no hay resultados". */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}

/** Casilla para mostrar lo oculto ("Mostrar inactivos", "Mostrar historial"): igual en todas las listas. */
export function ShowToggle({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none", className)}>
      <input type="checkbox" className="size-3.5 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * Pestañas dentro de una pantalla (Pagos: Asistencia / Quincena…; Compras:
 * Solicitudes / Pedidos): texto con subrayado, como las de arriba. En el
 * celular se deslizan de borde a borde y la elegida queda a la vista.
 */
export function SubTabs<T extends string>({
  value,
  onChange,
  tabs,
  end,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: React.ReactNode; badge?: React.ReactNode }[];
  /** Algo a la derecha de la fila (ej. un enlace). */
  end?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);
  return (
    <div
      ref={ref}
      role="tablist"
      className="-mx-4 flex items-center gap-5 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors",
              active ? "border-primary font-semibold text-foreground" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
      {end && <div className="ml-auto shrink-0 pb-2.5 pl-4">{end}</div>}
    </div>
  );
}
