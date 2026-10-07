import { describe, expect, it } from "vitest";

import { isMonthOccurred, isPeriodOccurred } from "./payroll-projection";

const NOW = { year: 2026, month: 5, half: 2 as const };

describe("isPeriodOccurred", () => {
  it("quincenas anteriores y la actual ya ocurrieron", () => {
    expect(isPeriodOccurred(2026, 5, 1, NOW)).toBe(true);
    expect(isPeriodOccurred(2026, 5, 2, NOW)).toBe(true);
    expect(isPeriodOccurred(2026, 1, 1, NOW)).toBe(true);
  });
  it("quincenas posteriores son proyección", () => {
    expect(isPeriodOccurred(2026, 6, 1, NOW)).toBe(false);
    expect(isPeriodOccurred(2026, 12, 2, NOW)).toBe(false);
  });
  it("años pasados todo ocurrido, años futuros todo proyección", () => {
    expect(isPeriodOccurred(2025, 12, 2, NOW)).toBe(true);
    expect(isPeriodOccurred(2027, 1, 1, NOW)).toBe(false);
  });
  it("en la 1a quincena de un mes, la 2a de ese mes todavía no ocurrió", () => {
    const early = { year: 2026, month: 5, half: 1 as const };
    expect(isPeriodOccurred(2026, 5, 1, early)).toBe(true);
    expect(isPeriodOccurred(2026, 5, 2, early)).toBe(false);
  });
});

describe("isMonthOccurred", () => {
  it("un mes cuenta si su primera quincena ya empezó", () => {
    const early = { year: 2026, month: 5, half: 1 as const };
    expect(isMonthOccurred(2026, 5, early)).toBe(true);
    expect(isMonthOccurred(2026, 6, early)).toBe(false);
  });
  it("años pasados / futuros", () => {
    expect(isMonthOccurred(2025, 12, NOW)).toBe(true);
    expect(isMonthOccurred(2027, 1, NOW)).toBe(false);
  });
});
