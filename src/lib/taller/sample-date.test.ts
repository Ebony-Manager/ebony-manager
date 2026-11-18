import { describe, expect, it } from "vitest";
import { nextSampleSaturday } from "./sample-date";

describe("sábado de las muestras", () => {
  it("de domingo a miércoles: el sábado de esa semana", () => {
    expect(nextSampleSaturday("2026-11-15")).toBe("2026-11-21"); // domingo
    expect(nextSampleSaturday("2026-11-16")).toBe("2026-11-21"); // lunes
    expect(nextSampleSaturday("2026-11-18")).toBe("2026-11-21"); // miércoles
  });
  it("de jueves a sábado: el sábado de la semana siguiente", () => {
    expect(nextSampleSaturday("2026-11-19")).toBe("2026-11-28"); // jueves
    expect(nextSampleSaturday("2026-11-20")).toBe("2026-11-28"); // viernes
    expect(nextSampleSaturday("2026-11-21")).toBe("2026-11-28"); // sábado
  });
  it("cruza el mes", () => {
    expect(nextSampleSaturday("2026-11-26")).toBe("2026-12-05");
  });
});
