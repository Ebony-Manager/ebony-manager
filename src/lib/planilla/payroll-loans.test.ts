import { describe, expect, it } from "vitest";
import {
  computeLoanSchedule,
  defaultLoanStartPeriod,
  loanPayoffPeriod,
} from "./payroll-loans";

// Cubre el reparto de cuotas de un préstamo/adelanto tal como lo hace la
// hoja "Ebony - Planilla 2026": cuotas iguales, el sobrante de la
// división entero en la ÚLTIMA cuota, la suma exacta = principal.

describe("computeLoanSchedule", () => {
  it("reparte en cuotas iguales cuando divide exacto", () => {
    const schedule = computeLoanSchedule(20_000, 8, { year: 2026, month: 1, half: 1 });
    expect(schedule).toHaveLength(8);
    expect(schedule.every((c) => c.amountCents === 2_500)).toBe(true);
    expect(schedule.reduce((s, c) => s + c.amountCents, 0)).toBe(20_000);
  });

  it("mete el sobrante en la última cuota, nunca pierde ni inventa un centavo", () => {
    const schedule = computeLoanSchedule(10_000, 3, { year: 2026, month: 1, half: 1 });
    expect(schedule.map((c) => c.amountCents)).toEqual([3_333, 3_333, 3_334]);
    expect(schedule.reduce((s, c) => s + c.amountCents, 0)).toBe(10_000);
  });

  it("avanza una quincena por cuota, cruzando meses", () => {
    const schedule = computeLoanSchedule(300, 3, { year: 2026, month: 12, half: 2 });
    expect(schedule.map((c) => c.period)).toEqual([
      { year: 2026, month: 12, half: 2 },
      { year: 2027, month: 1, half: 1 },
      { year: 2027, month: 1, half: 2 },
    ]);
  });

  it("una sola cuota = el principal completo", () => {
    const schedule = computeLoanSchedule(10_000, 1, { year: 2026, month: 6, half: 2 });
    expect(schedule).toEqual([{ period: { year: 2026, month: 6, half: 2 }, amountCents: 10_000 }]);
  });

  it("tira error con menos de 1 cuota", () => {
    expect(() => computeLoanSchedule(1_000, 0, { year: 2026, month: 1, half: 1 })).toThrow();
  });

  it("tira error con un esquema de pago no soportado", () => {
    expect(() =>
      // @ts-expect-error probando un esquema que el tipo no permite
      computeLoanSchedule(1_000, 2, { year: 2026, month: 1, half: 1 }, "porcentaje")
    ).toThrow(/no soportado/);
  });
});

describe("defaultLoanStartPeriod", () => {
  it("un adelanto cae en la quincena que ya contiene la fecha de solicitud", () => {
    expect(defaultLoanStartPeriod("adelanto", "2026-08-20")).toEqual({ year: 2026, month: 8, half: 2 });
    expect(defaultLoanStartPeriod("adelanto", "2026-08-10")).toEqual({ year: 2026, month: 8, half: 1 });
  });

  it("un préstamo cae en la quincena SIGUIENTE a la de la fecha de solicitud", () => {
    expect(defaultLoanStartPeriod("prestamo", "2026-08-10")).toEqual({ year: 2026, month: 8, half: 2 });
    expect(defaultLoanStartPeriod("prestamo", "2026-08-20")).toEqual({ year: 2026, month: 9, half: 1 });
  });

  it("devuelve null con una fecha inválida", () => {
    expect(defaultLoanStartPeriod("prestamo", "no-es-fecha")).toBeNull();
  });
});

describe("loanPayoffPeriod", () => {
  it("es la última quincena que toca el calendario", () => {
    expect(loanPayoffPeriod({ year: 2026, month: 1, half: 1 }, 8)).toEqual({ year: 2026, month: 4, half: 2 });
  });

  it("cruza la frontera de año", () => {
    expect(loanPayoffPeriod({ year: 2026, month: 11, half: 2 }, 4)).toEqual({ year: 2027, month: 1, half: 1 });
  });

  it("con una sola cuota, el payoff es el propio período de inicio", () => {
    expect(loanPayoffPeriod({ year: 2026, month: 6, half: 2 }, 1)).toEqual({ year: 2026, month: 6, half: 2 });
  });
});
