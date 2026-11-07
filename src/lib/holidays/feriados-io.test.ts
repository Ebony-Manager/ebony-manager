import { describe, expect, it } from "vitest";

import { parseFeriadosResponse, yearsToSync } from "./feriados-io";

describe("feriados.io", () => {
  it("lee los feriados del año e ignora lo raro", () => {
    const body = {
      success: true,
      data: [
        { date: "2026-01-01", name: "Año Nuevo", type: "national", irrenunciable: true },
        { date: "2026-11-02", name: "Día de los Difuntos", type: "national", irrenunciable: false, mandatory_rest: false },
        { date: "2026-12-21", original_date: "2026-12-20", name: "Día de Duelo Nacional", irrenunciable: true },
        { date: "2027-01-01", name: "Otro año" },
        { date: "malo", name: "x" },
        { date: "2026-05-01", name: "  " },
      ],
    };
    expect(parseFeriadosResponse(body, 2026)).toEqual([
      { date: "2026-01-01", name: "Año Nuevo", mandatory_rest: null, irrenunciable: true, original_date: null },
      { date: "2026-11-02", name: "Día de los Difuntos", mandatory_rest: false, irrenunciable: false, original_date: null },
      { date: "2026-12-21", name: "Día de Duelo Nacional", mandatory_rest: null, irrenunciable: true, original_date: "2026-12-20" },
    ]);
  });

  it("un error de la API no se toma como 'sin feriados'", () => {
    expect(() => parseFeriadosResponse({ success: false, error: { message: "API key" } }, 2026)).toThrow("API key");
    expect(() => parseFeriadosResponse(null, 2026)).toThrow();
  });

  it("desde octubre también el año siguiente", () => {
    expect(yearsToSync("2026-09-30")).toEqual([2026]);
    expect(yearsToSync("2026-10-01")).toEqual([2026, 2027]);
  });
});
