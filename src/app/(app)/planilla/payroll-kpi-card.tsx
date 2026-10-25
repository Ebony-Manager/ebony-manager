import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PAYROLL_CATEGORY, type PayrollCategoryKey } from "@/lib/planilla/payroll-colors";

/**
 * Tarjeta KPI compacta para Registro (y más adelante Resumen/Dashboard).
 * Portada de Atlas. `category` tiñe la tarjeta y el label con el color
 * de esa categoría; `color` es un escape para un acento puntual que no
 * es una de las categorías (ej. "Total a Pagar" en verde). El VALOR
 * siempre queda en el color de texto neutro para que el número grande
 * se lea contra cualquier tinte.
 */
export function PayrollKpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  category = "total",
  color,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  category?: PayrollCategoryKey;
  color?: string;
  className?: string;
}) {
  const isNeutral = !color && category === "total";
  const resolvedColor = color ?? PAYROLL_CATEGORY[category].color;
  const cardStyle: React.CSSProperties = isNeutral
    ? {}
    : {
        backgroundColor: `color-mix(in oklch, ${resolvedColor} 7%, var(--card))`,
        borderColor: `color-mix(in oklch, ${resolvedColor} 22%, var(--border))`,
      };
  const iconTintStyle: React.CSSProperties = isNeutral
    ? { backgroundColor: "color-mix(in oklch, var(--foreground) 8%, transparent)" }
    : { backgroundColor: `color-mix(in oklch, ${resolvedColor} 18%, transparent)` };
  const accentTextStyle: React.CSSProperties | undefined = isNeutral ? undefined : { color: resolvedColor };
  return (
    <div
      className={cn("flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3", className)}
      style={cardStyle}
    >
      {/* En el celular sin ícono: así el título y el monto caben enteros. */}
      <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex" style={iconTintStyle}>
        <Icon className="size-4" style={accentTextStyle} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-medium sm:truncate" style={accentTextStyle ?? { color: "var(--muted-foreground)" }}>
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground sm:truncate">{sublabel}</p>}
      </div>
    </div>
  );
}
