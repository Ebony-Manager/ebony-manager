import { describe, expect, it } from "vitest";

import { formatDateCompact, monthShort } from "@/lib/planilla/format";

describe("formatDateCompact", () => {
  it('formato "8-Ene-25" en español (día sin cero, mes 3 letras, año 2 dígitos)', () => {
    expect(formatDateCompact("es", "2025-01-08")).toBe("8-Ene-25");
    expect(formatDateCompact("es", "2026-12-31")).toBe("31-Dic-26");
    expect(formatDateCompact("es", "2024-09-05")).toBe("5-Sep-24");
  });

  it('formato "8-Jan-25" en inglés', () => {
    expect(formatDateCompact("en", "2025-01-08")).toBe("8-Jan-25");
    expect(formatDateCompact("en", "2026-08-03")).toBe("3-Aug-26");
  });

  it("meses en español: Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => monthShort("es", m))).toEqual([
      "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ]);
  });

  it("devuelve el ISO tal cual si no parsea", () => {
    expect(formatDateCompact("es", "")).toBe("");
    expect(formatDateCompact("es", "no-es-fecha")).toBe("no-es-fecha");
  });
});
