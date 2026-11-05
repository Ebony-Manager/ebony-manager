import type { QuoteStatus } from "@/types/cotizador";

/** Color de cada estado de cotización (tokens del tema; se ve bien en claro y oscuro). */
export const QUOTE_STATUS_STYLE: Record<QuoteStatus, string> = {
  BORRADOR: "bg-muted text-muted-foreground",
  ENVIADA: "bg-[color-mix(in_oklab,var(--status-warn)_20%,transparent)] text-foreground",
  APROBADA: "bg-[color-mix(in_oklab,var(--status-ok)_18%,transparent)] text-[var(--status-ok)]",
  RECHAZADA: "bg-[color-mix(in_oklab,var(--status-error)_14%,transparent)] text-[var(--status-error)]",
};
