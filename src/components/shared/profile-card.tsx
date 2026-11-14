import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Un bloque de una ficha (empleado, contratista…): tarjeta con ícono y título, una línea de apoyo
 * debajo y, a la derecha, su acción (Agregar, Editar, Registrar…). Todos los bloques de una ficha
 * usan este (ver UI-RULES.md): misma tarjeta, mismo encabezado, mismo lugar para el botón.
 */
export function ProfileCard({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Línea de apoyo bajo el título (ej. el saldo, o qué es el bloque). */
  subtitle?: React.ReactNode;
  /** Botón o botones de la derecha. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="size-4 shrink-0 text-primary" />
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}
