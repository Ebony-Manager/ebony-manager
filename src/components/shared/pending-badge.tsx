import { cn } from "@/lib/utils";

/**
 * Indicador rojo de "hay algo por revisar" (nuevos registros, solicitudes de
 * dinero): el número de pendientes en una pastilla. Sin pendientes no rinde
 * nada.
 */
export function PendingBadge({ count, className, title }: { count: number; className?: string; title?: string }) {
  if (count <= 0) return null;
  return (
    <span
      title={title}
      aria-label={title ? `${count} ${title}` : String(count)}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10.5px] leading-none font-semibold text-white tabular-nums",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
