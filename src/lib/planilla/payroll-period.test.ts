import { describe, expect, it } from "vitest";
import { MONTHS_ES, monthLabel, nextPeriod, periodKey, periodOrdinal, previousPeriod } from "./payroll-period";

// Portado de Atlas (Life OS) src/lib/home/payroll-period.test.ts, más
// casos para nextPeriod/periodOrdinal que en Atlas vivían implícitos en
// los tests de acumulados.

describe("periodKey", () => {
  it("formatea month-half como 'month-half'", () => {
    expect(periodKey(3, 1)).toBe("3-1");
    expect(periodKey(12, 2)).toBe("12-2");
  });
});

describe("MONTHS_ES", () => {
  it("tiene 12 entradas, enero primero", () => {
    expect(MONTHS_ES).toHaveLength(12);
    expect(MONTHS_ES[0]).toBe("Enero");
    expect(MONTHS_ES[11]).toBe("Diciembre");
  });
});

describe("monthLabel", () => {
  it("da el mes en el idioma pedido (1-indexado)", () => {
    expect(monthLabel("es", 1)).toBe("Enero");
    expect(monthLabel("en", 1)).toBe("January");
    expect(monthLabel("es", 12)).toBe("Diciembre");
    expect(monthLabel("en", 12)).toBe("December");
  });
});

describe("previousPeriod", () => {
  it("de la 2a quincena vuelve a la 1a, mismo mes", () => {
    expect(previousPeriod(2026, 6, 2)).toEqual({ year: 2026, month: 6, half: 1 });
  });

  it("de la 1a quincena vuelve a la 2a del mes anterior", () => {
    expect(previousPeriod(2026, 6, 1)).toEqual({ year: 2026, month: 5, half: 2 });
  });

  it("cruza la frontera de año — la anterior a la 1a de enero es la última de diciembre", () => {
    expect(previousPeriod(2026, 1, 1)).toEqual({ year: 2025, month: 12, half: 2 });
  });
});

describe("nextPeriod", () => {
  it("de la 1a quincena pasa a la 2a, mismo mes", () => {
    expect(nextPeriod({ year: 2026, month: 6, half: 1 })).toEqual({ year: 2026, month: 6, half: 2 });
  });

  it("de la 2a quincena pasa a la 1a del mes siguiente", () => {
    expect(nextPeriod({ year: 2026, month: 6, half: 2 })).toEqual({ year: 2026, month: 7, half: 1 });
  });

  it("cruza la frontera de año — después de la 2a de diciembre viene la 1a de enero", () => {
    expect(nextPeriod({ year: 2026, month: 12, half: 2 })).toEqual({ year: 2027, month: 1, half: 1 });
  });
});

describe("periodOrdinal", () => {
  it("es estrictamente creciente quincena a quincena", () => {
    const a = periodOrdinal(2026, 1, 1);
    const b = periodOrdinal(2026, 1, 2);
    const c = periodOrdinal(2026, 2, 1);
    const d = periodOrdinal(2027, 1, 1);
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
    expect(d).toBe(periodOrdinal(2026, 12, 2) + 1);
  });
});
