import { describe, expect, it } from "vitest";
import { toBlocks } from "./blocks";

const it_ = (id: string, area: string, stage: "por_medir" | "en_diseno", blockId: string | null, since = "2026-11-20", sortOrder = 0) => ({
  id,
  projectId: "p",
  area,
  stage,
  blockId,
  stageSince: since,
  sortOrder,
});

describe("bloques del tablero", () => {
  it("en Por medir agrupa por área", () => {
    const b = toBlocks([it_("1", "Lavandería", "por_medir", null), it_("2", "lavandería ", "por_medir", null), it_("3", "Sala", "por_medir", null)]);
    expect(b.map((x) => x.items.map((i) => i.id))).toEqual([["1", "2"], ["3"]]);
  });
  it("después agrupa por el bloque con que avanzaron, aunque sean de áreas distintas", () => {
    const b = toBlocks([it_("1", "Sala", "en_diseno", "x"), it_("2", "Comedor", "en_diseno", "x"), it_("3", "Sala", "en_diseno", null)]);
    expect(b.map((x) => x.items.map((i) => i.id))).toEqual([["1", "2"], ["3"]]);
    expect(b[0].areas).toEqual(["Sala", "Comedor"]);
  });
  it("el bloque está desde el ítem que lleva más tiempo, y el más antiguo va primero", () => {
    const b = toBlocks([it_("1", "A", "en_diseno", "x", "2026-11-22"), it_("2", "A", "en_diseno", "x", "2026-11-18"), it_("3", "B", "en_diseno", "y", "2026-11-20")]);
    expect(b.map((x) => x.since)).toEqual(["2026-11-18", "2026-11-20"]);
  });
});
