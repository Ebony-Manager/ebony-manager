import { describe, expect, it } from "vitest";

import type { Tool, ToolLoan } from "@/types/almacen";
import { compareTools, daysBetween, isOverdue, matchesToolFilter, openLoans, shownStatus, toolName } from "./tools";

const tool = (p: Partial<Tool>): Tool => ({ id: "t", name: "Engalletadora", number: 1, category: "electrica", brand: null, notes: null, photoPath: null, status: "disponible", active: true, ...p });
const loan = (p: Partial<ToolLoan>): ToolLoan => ({
  id: "l", toolId: "t", employeeId: "e", contractorId: null, projectId: null, lentOn: "2026-10-20", dueOn: "2026-10-27", hasDueDate: false,
  returnedOn: null, returnCondition: null, notes: null, returnNotes: null, lentByName: null, returnedByName: null, ...p,
});

describe("herramientas", () => {
  it("nombre con número", () => {
    expect(toolName({ name: "Engalletadora", number: 1 })).toBe("Engalletadora #1");
    expect(toolName({ name: "Nivel", number: null })).toBe("Nivel");
  });

  it("vencida: prestada y pasada la fecha (ese día todavía no)", () => {
    expect(isOverdue(loan({ dueOn: "2026-10-27" }), "2026-10-27")).toBe(false);
    expect(isOverdue(loan({ dueOn: "2026-10-27" }), "2026-10-28")).toBe(true);
    expect(isOverdue(loan({ returnedOn: "2026-10-28" }), "2026-10-30")).toBe(false);
    expect(shownStatus(tool({ status: "prestada" }), loan({}), "2026-10-28")).toBe("vencida");
    expect(shownStatus(tool({ status: "reparacion" }), undefined, "2026-10-28")).toBe("reparacion");
  });

  it("filtros", () => {
    expect(matchesToolFilter("vencida", "lent")).toBe(true);
    expect(matchesToolFilter("prestada", "overdue")).toBe(false);
    expect(matchesToolFilter("danada", "out")).toBe(true);
    expect(matchesToolFilter("disponible", "stock")).toBe(true);
  });

  it("préstamos abiertos y orden", () => {
    const open = openLoans([loan({ id: "a", returnedOn: "2026-10-21" }), loan({ id: "b" })]);
    expect(open.get("t")?.id).toBe("b");
    const rows = [
      { tool: tool({ name: "Taladro", number: 2 }), status: "disponible" as const },
      { tool: tool({ name: "Taladro", number: 1 }), status: "vencida" as const },
      { tool: tool({ name: "Lijadora" }), status: "disponible" as const },
    ].sort(compareTools);
    expect(rows.map((r) => toolName(r.tool))).toEqual(["Taladro #1", "Lijadora #1", "Taladro #2"]);
    expect(daysBetween("2026-10-20", "2026-10-29")).toBe(9);
  });
});
