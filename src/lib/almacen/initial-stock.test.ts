import { describe, expect, it } from "vitest";
import { initialStockLines } from "./initial-stock";

describe("initial stock count", () => {
  it("leaves blanks untouched and preserves explicit zero", () => {
    expect(initialStockLines({ untouched: "", spaces: "  ", empty: "0", full: "15" })).toEqual([
      { variantId: "empty", qty: 0 }, { variantId: "full", qty: 15 },
    ]);
  });
  it("accepts decimal counts with comma or period", () => {
    expect(initialStockLines({ a: " 1,5 ", b: "2.25" })).toEqual([
      { variantId: "a", qty: 1.5 }, { variantId: "b", qty: 2.25 },
    ]);
  });
  it.each(["-1", "NaN", "Infinity", "1,000.5", "2 unidades", "0x10", "1e3"])("rejects ambiguous or invalid count %s before submitting any line", (value) => {
    expect(() => initialStockLines({ valid: "5", invalid: value })).toThrow();
  });
});
