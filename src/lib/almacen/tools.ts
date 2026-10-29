// Herramientas del Almacén (sin Supabase ni React): nombre, estado que se
// muestra (una prestada pasada de fecha es "vencida"), filtros y días.

import type { Tool, ToolLoan, ToolStatus } from "@/types/almacen";

/** "Engalletadora #1"; sin número, solo el nombre. */
export function toolName(t: Pick<Tool, "name" | "number">): string {
  return t.number != null ? `${t.name} #${t.number}` : t.name;
}

export type ToolShownStatus = ToolStatus | "vencida";
export type ToolFilter = "all" | "stock" | "lent" | "overdue" | "out";

/** Días de `from` a `to` (fechas ISO, sin hora). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isOverdue(loan: Pick<ToolLoan, "dueOn" | "returnedOn">, today: string): boolean {
  return loan.returnedOn == null && loan.dueOn < today;
}

/** El préstamo abierto de cada herramienta (a lo sumo uno). */
export function openLoans(loans: readonly ToolLoan[]): Map<string, ToolLoan> {
  return new Map(loans.filter((l) => l.returnedOn == null).map((l) => [l.toolId, l]));
}

export function shownStatus(tool: Pick<Tool, "status">, loan: ToolLoan | undefined, today: string): ToolShownStatus {
  return tool.status === "prestada" && loan && isOverdue(loan, today) ? "vencida" : tool.status;
}

export function matchesToolFilter(status: ToolShownStatus, f: ToolFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "stock":
      return status === "disponible";
    case "lent":
      return status === "prestada" || status === "vencida";
    case "overdue":
      return status === "vencida";
    case "out":
      return status === "reparacion" || status === "danada" || status === "perdida";
  }
}

/** Orden de la lista: vencidas primero, luego prestadas, en almacén y fuera de uso; dentro, por nombre y número. */
const ORDER: Record<ToolShownStatus, number> = { vencida: 0, prestada: 1, disponible: 2, reparacion: 3, danada: 4, perdida: 5 };
export function compareTools(a: { tool: Tool; status: ToolShownStatus }, b: { tool: Tool; status: ToolShownStatus }): number {
  return (
    ORDER[a.status] - ORDER[b.status] ||
    a.tool.name.localeCompare(b.tool.name, "es") ||
    (a.tool.number ?? 0) - (b.tool.number ?? 0)
  );
}
