import { describe, expect, it } from "vitest";

import type { QuoteSection } from "@/types/cotizador";
import { duplicateSection, groupedOrder, locationGroups, locationSuggestions, moveSection, shiftSection } from "./items";

const sec = (id: string, location: string, extra: Partial<QuoteSection> = {}): QuoteSection => ({
  id,
  location,
  name: id,
  kind: "Mueble",
  description: "",
  qty: 1,
  utilPct: 0,
  subMarginPct: 0,
  wasteSheets: 0,
  wastePct: 0,
  wasteSheetPrice: 0,
  design3d: 10,
  extraLabor: 0,
  freight: 0,
  commissionPct: 0,
  ccfPct: 0,
  wallShape: "recta",
  cornerAt: null,
  lines: [],
  ...extra,
});
const ids = (list: QuoteSection[]) => list.map((s) => s.id);

describe("lista de ítems", () => {
  const list = [sec("a", "Rec #8"), sec("b", "Sala"), sec("c", "REC  #8 "), sec("d", "")];

  it("agrupa por ubicación sin importar mayúsculas ni espacios, con su subtotal (× cantidad)", () => {
    const g = locationGroups([...list, sec("e", "Sala", { qty: 3 })]);
    expect(g.map((x) => [x.label, ids(x.sections)])).toEqual([
      ["Rec #8", ["a", "c"]],
      ["Sala", ["b", "e"]],
      ["", ["d"]],
    ]);
    expect(g[1].total).toBe(40);
    expect(ids(groupedOrder(list))).toEqual(["a", "c", "b", "d"]);
    expect(locationSuggestions(list)).toEqual(["Rec #8", "Sala"]);
  });

  it("arrastrar a otra ubicación le pone esa ubicación", () => {
    const next = moveSection(list, "d", "b");
    expect(ids(next)).toEqual(["a", "c", "d", "b"]);
    expect(next.find((s) => s.id === "d")?.location).toBe("Sala");
  });

  it("sube y baja dentro de su ubicación", () => {
    expect(ids(shiftSection(list, "c", -1))).toEqual(["c", "a", "b", "d"]);
    expect(ids(shiftSection(list, "a", -1))).toEqual(["a", "c", "b", "d"]);
  });

  it("duplicar copia con ids nuevos, justo después", () => {
    let n = 0;
    const withLines = [sec("a", "Sala", { lines: [{ id: "l1", hostLineId: null } as never, { id: "l2", hostLineId: "l1" } as never] })];
    const { sections, copyId } = duplicateSection(withLines, "a", () => `n${++n}`);
    expect(ids(sections)).toEqual(["a", copyId]);
    const copy = sections[1];
    expect(copy.lines.map((l) => [l.id, l.hostLineId])).toEqual([
      ["n1", null],
      ["n2", "n1"],
    ]);
  });
});
