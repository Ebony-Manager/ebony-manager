import { describe, expect, it } from "vitest";

import { buildSummaryEmail, type DailySummary } from "./daily-summary";

const base: DailySummary = {
  today: "2026-10-24",
  dow: 6,
  enabled: true,
  days: [1, 2, 3, 4, 5, 6],
  recipients: ["a@b.com"],
  low_stock: [],
  pending_requests: [],
  open_orders: [],
  yesterday: { issues: 0, lines: 0, short: [] },
};

describe("buildSummaryEmail", () => {
  it("sin nada que avisar no tiene contenido", () => {
    const e = buildSummaryEmail(base, "https://app");
    expect(e.hasContent).toBe(false);
    expect(e.subject).toContain("todo en orden");
  });

  it("arma el asunto y las secciones", () => {
    const e = buildSummaryEmail(
      {
        ...base,
        low_stock: [{ category: "Herrajería", name: "Riel de gaveta", label: "40 cm", unit: "par", stock: 0, min: 6, reorder: 12, requested: true }],
        pending_requests: [{ name: "Escobas <x>", label: null, qty: 3, unit: "unidad", by: "Karina", auto: false, created_at: "2026-10-23T10:00:00Z" }],
        open_orders: [{ supplier: "Dimosa", ordered_on: "2026-10-17", status: "pedido", days: 7, lines: 2 }],
        yesterday: { issues: 4, lines: 9, short: ["High Tack"] },
      },
      "https://app",
    );
    expect(e.hasContent).toBe(true);
    expect(e.subject).toBe("Almacén · sábado, 24 de octubre: 1 bajo stock, 1 por pedir, 1 pedidos por llegar");
    expect(e.html).toContain("Riel de gaveta");
    expect(e.html).toContain("0 pares");
    expect(e.html).toContain("Escobas &lt;x&gt;");
    expect(e.html).toContain("7 días");
    expect(e.html).toContain("4 salidas con 9 productos");
    expect(e.html).toContain("https://app/almacen");
    expect(e.html).toContain("/email/ebony-logo.png");
    expect(e.text).toContain("- Riel de gaveta · 40 cm: hay 0 pares, mínimo 6");
  });

  it("herramientas vencidas: en el asunto y en una sección", () => {
    const e = buildSummaryEmail({ ...base, overdue_tools: [{ name: "Engalletadora #1", person: "Wilfredo", lent_on: "2026-10-10", due_on: "2026-10-17", days: 7 }] }, "https://app");
    expect(e.hasContent).toBe(true);
    expect(e.subject).toContain("1 herramienta vencida");
    expect(e.html).toContain("Herramientas vencidas (1)");
    expect(e.text).toContain("Engalletadora #1: Wilfredo, 7 días tarde");
  });
});
