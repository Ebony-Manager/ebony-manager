import { describe, expect, it } from "vitest";

import { niceAxis } from "./chart-axis";

describe("niceAxis", () => {
  it("máximo 0 o inválido -> un tramo mínimo", () => {
    expect(niceAxis(0)).toMatchObject({ ticks: [0, 50], max: 50 });
    expect(niceAxis(NaN).max).toBe(50);
  });
  it("redondea hacia arriba a un múltiplo del paso", () => {
    expect(niceAxis(4800)).toEqual({ ticks: [0, 1000, 2000, 3000, 4000, 5000], max: 5000, step: 1000 });
    expect(niceAxis(1020)).toMatchObject({ max: 1250, step: 250 });
  });
  it("el máximo nunca queda por debajo del dato", () => {
    for (const v of [1, 99, 480, 1234, 7777, 123456]) expect(niceAxis(v).max).toBeGreaterThanOrEqual(v);
  });
  it("como mucho maxTicks tramos", () => {
    expect(niceAxis(4800).ticks.length - 1).toBeLessThanOrEqual(5);
  });
});
