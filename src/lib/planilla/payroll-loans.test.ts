import { describe, expect, it } from "vitest";
import {
  computeLoanSchedule,
  defaultLoanStartPeriod,
  loanPayoffPeriod,
  reflowLoanSchedule,
  type PendingInstallment,
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

describe("reflowLoanSchedule", () => {
  // 3 cuotas pendientes de $100 (P1, P2, P3) = $300 de saldo pendiente.
  const P1 = { year: 2026, month: 1, half: 1 } as const;
  const P2 = { year: 2026, month: 1, half: 2 } as const;
  const P3 = { year: 2026, month: 2, half: 1 } as const;
  const P4 = { year: 2026, month: 2, half: 2 } as const;
  function threeEqual(): PendingInstallment[] {
    return [
      { ledgerEntryId: "a", period: P1, amountCents: 10_000 },
      { ledgerEntryId: "b", period: P2, amountCents: 10_000 },
      { ledgerEntryId: "c", period: P3, amountCents: 10_000 },
    ];
  }
  const sum = (xs: { amountCents: number }[]) => xs.reduce((s, x) => s + x.amountCents, 0);

  it("saltar una cuota (a $0): las demás quedan igual, se agrega una quincena al final", () => {
    const result = reflowLoanSchedule(threeEqual(), "b", 0);
    // "b" (P2) se saltó y desaparece del calendario.
    expect(result.find((r) => r.ledgerEntryId === "b")).toBeUndefined();
    expect(result.find((r) => r.ledgerEntryId === "a")).toEqual({ ledgerEntryId: "a", period: P1, amountCents: 10_000 });
    expect(result.find((r) => r.ledgerEntryId === "c")).toEqual({ ledgerEntryId: "c", period: P3, amountCents: 10_000 });
    // Se agregó UNA quincena más al final (P4) por los $100 que faltan.
    const added = result.find((r) => r.ledgerEntryId === null);
    expect(added).toEqual({ ledgerEntryId: null, period: P4, amountCents: 10_000 });
    expect(sum(result)).toBe(30_000);
  });

  it("reducir una cuota (no a $0): las que siguen quedan igual, se agrega el faltante al final", () => {
    const result = reflowLoanSchedule(threeEqual(), "b", 6_000);
    expect(result.find((r) => r.ledgerEntryId === "a")!.amountCents).toBe(10_000);
    expect(result.find((r) => r.ledgerEntryId === "b")!.amountCents).toBe(6_000);
    expect(result.find((r) => r.ledgerEntryId === "c")!.amountCents).toBe(10_000);
    const added = result.find((r) => r.ledgerEntryId === null);
    expect(added).toEqual({ ledgerEntryId: null, period: P4, amountCents: 4_000 });
    expect(sum(result)).toBe(30_000);
  });

  it("pagar de más (abonar más en la primera cuota): el calendario se acorta, nunca se alarga", () => {
    // Sube "a" de 100 a 250 — el sobrante ($150) se descuenta de las
    // últimas cuotas primero: "c" ($100) desaparece, "b" baja a $50.
    const result = reflowLoanSchedule(threeEqual(), "a", 25_000);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.ledgerEntryId === "a")!.amountCents).toBe(25_000);
    expect(result.find((r) => r.ledgerEntryId === "b")!.amountCents).toBe(5_000);
    expect(result.find((r) => r.ledgerEntryId === "c")).toBeUndefined();
    expect(sum(result)).toBe(30_000);
  });

  it("pagar exacto (saldar todo en una sola cuota): el calendario queda en una sola cuota", () => {
    const result = reflowLoanSchedule(threeEqual(), "a", 30_000);
    expect(result).toEqual([{ ledgerEntryId: "a", period: P1, amountCents: 30_000 }]);
  });

  it("acota un monto mayor a lo que queda por cobrar de ahí en adelante", () => {
    // Pedir más que el total pendiente no tiene sentido — se acota.
    const result = reflowLoanSchedule(threeEqual(), "a", 999_999);
    expect(sum(result)).toBe(30_000);
    expect(result).toEqual([{ ledgerEntryId: "a", period: P1, amountCents: 30_000 }]);
  });

  it("editar sin cambiar el monto no altera nada", () => {
    const result = reflowLoanSchedule(threeEqual(), "b", 10_000);
    expect(result).toEqual(threeEqual());
  });

  it("tira error si la cuota a editar no está entre las pendientes", () => {
    expect(() => reflowLoanSchedule(threeEqual(), "z", 5_000)).toThrow();
  });

  it("tira error con una lista de pendientes vacía", () => {
    expect(() => reflowLoanSchedule([], "a", 5_000)).toThrow();
  });
});

describe("cuota variable", () => {
  const start = { year: 2026, month: 10, half: 1 as const };
  it("usa los montos dados, una cuota por quincena", () => {
    const s = computeLoanSchedule(30000, 3, start, "cuota_variable", [10000, 5000, 15000]);
    expect(s.map((i) => i.amountCents)).toEqual([10000, 5000, 15000]);
    expect(s.map((i) => `${i.period.month}-${i.period.half}`)).toEqual(["10-1", "10-2", "11-1"]);
  });
  it("rechaza montos que no suman el principal", () => {
    expect(() => computeLoanSchedule(30000, 2, start, "cuota_variable", [10000, 5000])).toThrow();
  });
  it("rechaza cuotas en cero", () => {
    expect(() => computeLoanSchedule(10000, 2, start, "cuota_variable", [10000, 0])).toThrow();
  });
});

describe("reflowLoanSchedule · repartir", () => {
  const mk = (id: string, month: number, half: 1 | 2, amountCents: number) => ({
    ledgerEntryId: id,
    period: { year: 2026, month, half },
    amountCents,
  });
  const pending = [mk("a", 10, 1, 10000), mk("b", 10, 2, 10000), mk("c", 11, 1, 10000), mk("d", 11, 2, 10000)];

  it("bajar una cuota reparte el faltante entre las que siguen", () => {
    const r = reflowLoanSchedule(pending, "a", 5000, "spread");
    expect(r.map((i) => i.amountCents)).toEqual([5000, 11666, 11666, 11668]);
    expect(r.reduce((s, i) => s + i.amountCents, 0)).toBe(40000);
  });
  it("modo agregar al final deja las demás igual y alarga", () => {
    const r = reflowLoanSchedule(pending, "a", 5000, "extend");
    expect(r.map((i) => i.amountCents)).toEqual([5000, 10000, 10000, 10000, 5000]);
  });
  it("subir una cuota reparte el exceso quitándolo a las que siguen", () => {
    const r = reflowLoanSchedule(pending, "a", 16000, "spread");
    expect(r.map((i) => i.amountCents)).toEqual([16000, 8000, 8000, 8000]);
  });
  it("sin cuotas posteriores cae al comportamiento de agregar", () => {
    const r = reflowLoanSchedule([mk("a", 10, 1, 10000)], "a", 4000, "spread");
    expect(r.map((i) => i.amountCents)).toEqual([4000, 6000]);
  });
});
