import { describe, expect, it } from "vitest";

import { joinTitle, routeTitleParts } from "./page-title";

describe("nombre de la pestaña", () => {
  it("lo específico primero, sin partes vacías, con ● si hay cambios", () => {
    expect(joinTitle(["COT-2640 Teo Zebede", "Cotización"])).toBe("COT-2640 Teo Zebede · Cotización");
    expect(joinTitle(["", null, "Cotización"], true)).toBe("● Cotización");
    expect(joinTitle([])).toBe("Ebony");
  });

  it("cada pantalla tiene su nombre", () => {
    expect(routeTitleParts("/cotizacion", "es")).toEqual(["Cotizaciones", "Ventas"]);
    expect(routeTitleParts("/cotizacion/seguimiento", "es")).toEqual(["Seguimiento", "Ventas"]);
    expect(routeTitleParts("/cotizacion/abc-123", "en")).toEqual(["Quote"]);
    expect(routeTitleParts("/personal/pagos", "es")).toEqual(["Pagos", "Personal"]);
    expect(routeTitleParts("/inspecciones/programacion", "es")).toEqual(["Programación", "Inspecciones"]);
    expect(routeTitleParts("/dashboard", "es")).toEqual(["Dashboard"]);
  });
});
