"use client";

import type { InventoryPerson, ToolLoan } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { daysBetween, type ToolShownStatus } from "@/lib/almacen/tools";
import { formatDateCompact } from "@/lib/planilla/format";
import { useTa } from "../shared";

export type Project = { id: string; name: string; active: boolean };

const BADGE: Record<ToolShownStatus, "success" | "secondary" | "destructive" | "warning" | "outline"> = {
  disponible: "success",
  prestada: "secondary",
  vencida: "destructive",
  reparacion: "warning",
  danada: "destructive",
  perdida: "outline",
};

export function ToolStatusBadge({ status }: { status: ToolShownStatus }) {
  const { ta } = useTa();
  return <Badge variant={BADGE[status]}>{ta(`tool_st_${status}`)}</Badge>;
}

/** Nombre de quien tiene el préstamo (empleado o contratista). */
export function holderName(loan: Pick<ToolLoan, "employeeId" | "contractorId">, people: Map<string, InventoryPerson>): string {
  return people.get(loan.employeeId ?? loan.contractorId ?? "")?.name ?? "—";
}

/** "28-Oct-26 · hace 3 días" / "vence hoy" / "3 días tarde", para la fecha de devolución. */
export function useDueText() {
  const { ta, lang } = useTa();
  return (dueOn: string, today: string) => {
    const d = daysBetween(today, dueOn);
    const rel = d === 0 ? ta("due_today") : d < 0 ? ta("days_late", { n: -d }) : null;
    return rel ? `${formatDateCompact(lang, dueOn)} · ${rel}` : formatDateCompact(lang, dueOn);
  };
}
