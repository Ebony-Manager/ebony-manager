import type { LucideIcon } from "lucide-react";

import { KpiCard } from "@/components/shared/kpi-card";
import { PAYROLL_CATEGORY, type PayrollCategoryKey } from "@/lib/planilla/payroll-colors";

/**
 * La tarjeta común (KpiCard) con el color de una categoría de planilla en
 * el ícono (salario azul, bonos verde, descuentos vino…). "total" queda
 * neutra. `color` es un escape para un acento puntual.
 */
export function PayrollKpiCard({
  icon,
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
  return (
    <KpiCard
      icon={icon}
      label={label}
      value={value}
      sublabel={sublabel}
      color={color ?? (category === "total" ? undefined : PAYROLL_CATEGORY[category].color)}
      tone={category === "total" && !color ? "primary" : "neutral"}
      className={className}
    />
  );
}
