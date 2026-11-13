"use client";

import type { InventoryPerson, ToolLoan } from "@/types/almacen";
import { StatusBadge } from "@/components/shared/status-badge";
import { daysBetween, type ToolShownStatus } from "@/lib/almacen/tools";
import { formatDateCompact } from "@/lib/planilla/format";
import { useTa } from "../shared";

export type Project = { id: string; name: string; active: boolean };

export function ToolStatusBadge({ status }: { status: ToolShownStatus }) {
  const { ta } = useTa();
  return <StatusBadge status={`tool_${status}`}>{ta(`tool_st_${status}`)}</StatusBadge>;
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
