import { describe, expect, it } from "vitest";

import { DEFAULT_COMPANY, DEFAULT_TERMS, flattenItems, parseCompany, parseTerms, unflattenItems } from "./documents";

describe("ajustes de documentos", () => {
  it("puntos y sub-puntos en una lista (ida y vuelta)", () => {
    const items = ["Primero **importante**.", { text: "No realiza:", sub: ["**Plomería:** tuberías.", "**Electricidad:** cableado."] }, "Último."];
    const rows = flattenItems(items);
    expect(rows.map((r) => r.sub)).toEqual([false, false, true, true, false]);
    expect(unflattenItems(rows)).toEqual(items);
    expect(unflattenItems([{ text: " ", sub: false }, { text: "b", sub: true }, { text: " a ", sub: false }, { text: "c", sub: true }])).toEqual(["b", { text: "a", sub: ["c"] }]);
  });

  it("lo que falte o venga mal toma el valor de siempre", () => {
    expect(parseTerms(null)).toEqual(DEFAULT_TERMS);
    expect(parseTerms({ sections: [{ title: "X", items: ["a", 3, { text: "b", sub: ["c", 1] }] }] }).sections).toEqual([{ title: "X", items: ["a", { text: "b", sub: ["c"] }] }]);
    expect(parseCompany({ phone: "1234" })).toEqual({ ...DEFAULT_COMPANY, phone: "1234" });
  });

  it("las condiciones de siempre se pueden editar sin perder nada", () => {
    for (const s of DEFAULT_TERMS.sections) expect(unflattenItems(flattenItems(s.items))).toEqual(s.items);
  });
});
