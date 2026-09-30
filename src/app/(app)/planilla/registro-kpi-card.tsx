import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta KPI del resumen de Registro — estilo aprobado por Teofilo:
 * tarjeta blanca, barra superior en degradé nogal, el número pintado en
 * degradé. A propósito uniforme: a diferencia de `PayrollKpiCard`
 * (Dashboard, historial del empleado), esta NO tiñe por categoría —
 * Teofilo lo pidió así para las 5 tarjetas de arriba de Registro,
 * sabiendo que se pierde la diferenciación por color acá. Por eso es un
 * componente aparte y no una reescritura de PayrollKpiCard: ese sigue
 * usando payroll-colors.ts sin cambios en Dashboard y en el historial.
 */
export function RegistroKpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-ink-900/8 bg-card px-4 py-4", className)}>
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklch, var(--walnut) 55%, white 45%), var(--walnut))",
        }}
      />
      <div
        className="mt-1 mb-2.5 flex size-[30px] items-center justify-center rounded-[8px]"
        style={{ backgroundColor: "var(--walnut-tint)" }}
      >
        <Icon size={15} strokeWidth={1.7} style={{ color: "var(--walnut)" }} />
      </div>
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-900/45">{label}</p>
      <p
        className="mt-0.5 text-[22px] font-extrabold tabular-nums"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklch, var(--walnut) 100%, black 8%), color-mix(in oklch, var(--walnut) 100%, white 25%))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 truncate text-[11px] text-ink-900/40">{sublabel}</p>}
    </div>
  );
}
