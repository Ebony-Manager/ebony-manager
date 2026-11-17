"use client";

import type { InventoryPerson, ToolLoan } from "@/types/almacen";
import { StatusBadge } from "@/components/shared/status-badge";
import { ContractorAvatar } from "../../contratistas/contractor-avatar";
import { THUMB_WIDTH, photoUrl } from "@/lib/photo-url";
import { ICON } from "@/lib/ui/concepts";
import { daysBetween, type ToolShownStatus } from "@/lib/almacen/tools";
import { formatDateCompact } from "@/lib/planilla/format";
import { useTa } from "../shared";

export type Project = { id: string; name: string; active: boolean };

export function ToolStatusBadge({ status }: { status: ToolShownStatus }) {
  const { ta } = useTa();
  return <StatusBadge status={`tool_${status}`}>{ta(`tool_st_${status}`)}</StatusBadge>;
}

/**
 * Quién tiene la herramienta, para verlo de un vistazo: su foto de perfil
 * (o la inicial), el nombre y, debajo, el proyecto para el que se la llevó.
 */
export function ToolHolder({
  loan,
  people,
  projectName,
  size = "md",
}: {
  loan: ToolLoan;
  people: Map<string, InventoryPerson>;
  projectName: string | null;
  size?: "sm" | "md";
}) {
  const person = people.get(loan.employeeId ?? loan.contractorId ?? "");
  const name = person?.name ?? "—";
  const bucket = person?.kind === "contratista" ? "contractor-photos" : "employee-photos";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ContractorAvatar name={name} photoUrl={person?.photoPath ? photoUrl(bucket, person.photoPath, THUMB_WIDTH) : null} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{name}</span>
        {projectName && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <ICON.project className="size-3 shrink-0" />
            <span className="truncate">{projectName}</span>
          </span>
        )}
      </span>
    </span>
  );
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
