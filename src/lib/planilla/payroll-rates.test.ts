import { describe, expect, it } from "vitest";
import { dailyRateCents, hourlyRateCents, quantityToCents } from "./payroll-rates";

// La tarifa por hora divide el salario mensual entre 240 (120 h/quincena)
// y la tarifa por día entre 30 — convención de planilla en Panamá, ver
// payroll-rates.ts. Las cantidades entran a centésimas y el producto se
// redondea una vez a centavos enteros.

describe("hourlyRateCents", () => {
  it("divide el salario mensual entre 240", () => {
    expect(hourlyRateCents({ baseSalaryCents: 240_000 })).toBe(1_000);
    expect(hourlyRateCents({ baseSalaryCents: 75_000 })).toBeCloseTo(312.5, 5);
  });
});

describe("dailyRateCents", () => {
  it("divide el salario mensual entre 30", () => {
    expect(dailyRateCents({ baseSalaryCents: 30_000 })).toBe(1_000);
    expect(dailyRateCents({ baseSalaryCents: 75_000 })).toBe(2_500);
  });
});

describe("quantityToCents", () => {
  it("multiplica cantidad x tarifa y redondea a centavos enteros", () => {
    expect(quantityToCents(3.38, 1_000)).toBe(3_380);
    expect(quantityToCents(2.5, 313)).toBe(Math.round(2.5 * 313)); // 783 (782.5 -> 783)
    expect(quantityToCents(0, 9_999)).toBe(0);
  });

  it("redondea una sola vez (no drifta un centavo)", () => {
    // 3.335 h a $3.125/h = 1041.71875 -> 1042
    expect(quantityToCents(3.335, 312.5)).toBe(1_042);
  });
});
