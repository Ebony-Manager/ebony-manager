import type { LucideIcon } from "lucide-react";

/**
 * El título de un grupo dentro de una lista (Ferretería, Herrajería…): el mismo
 * en todas las pantallas (ver UI-RULES.md). Texto normal (no mayúsculas), en
 * negrita, con línea debajo y la cantidad en una pastilla. El ícono es
 * opcional y genérico (ej. Materiales / Servicios): no se inventa uno por
 * grupo, porque los grupos los crea la gente y cambian.
 */
export function ListGroupHeader({ title, count, icon: Icon }: { title: string; count?: number; icon?: LucideIcon }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-border pb-1.5 text-sm font-semibold text-foreground">
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 truncate">{title}</span>
      {count != null && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
      )}
    </h2>
  );
}
