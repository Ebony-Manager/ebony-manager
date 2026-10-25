import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Tono del ícono: lo que el número "es", para encontrarlo de un vistazo. */
export type KpiTone = "neutral" | "primary" | "positive" | "negative" | "warning";

const TONE_COLOR: Record<KpiTone, string> = {
  neutral: "var(--muted-foreground)",
  primary: "var(--primary)",
  positive: "var(--success)",
  negative: "var(--destructive)",
  warning: "var(--warning)",
};

/**
 * La tarjeta de números de toda la app (Quincena, Préstamos, Resumen,
 * Dashboard…): fondo neutro, ícono en un cuadrito de color (por tono o por
 * un color propio, ej. el de una categoría de planilla), el título chico,
 * el número grande y una línea debajo. Con `trend` muestra ▲/▼ en verde o
 * rojo según si subir es bueno (`goodWhen`).
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "neutral",
  color,
  trend,
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: KpiTone;
  /** Color propio del ícono (gana sobre `tone`). */
  color?: string;
  /** Cambio contra el período anterior, en %. */
  trend?: { pct: number; goodWhen: "up" | "down"; label?: string };
  onClick?: () => void;
  className?: string;
}) {
  const accent = color ?? TONE_COLOR[tone];
  const up = trend ? trend.pct >= 0 : false;
  const good = trend ? (trend.goodWhen === "up" ? up : !up) : false;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-3 text-left sm:px-4",
        onClick && "transition-colors hover:bg-muted/40 active:bg-muted/60",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)` }}
        >
          <Icon className="size-3.5" style={{ color: accent }} />
        </span>
        <p className="line-clamp-2 text-xs leading-tight font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg leading-tight font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
      {trend && (
        <p className={cn("flex items-center gap-0.5 text-[11px] font-medium", good ? "text-success" : "text-destructive")}>
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(trend.pct).toFixed(0)}%{trend.label && <span className="font-normal text-muted-foreground"> {trend.label}</span>}
        </p>
      )}
      {sublabel && <p className="text-[11px] leading-snug text-muted-foreground">{sublabel}</p>}
    </Tag>
  );
}
