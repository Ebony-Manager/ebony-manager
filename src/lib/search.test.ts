import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "./search";

describe("búsqueda normalizada", () => {
  it.each([
    ["José", "jose"],
    ["Lámina MDF", "lamina"],
    ["PINGÜINO", "pinguino"],
    ["  Carlos   Pérez ", "carlos perez"],
  ])("%s coincide con %s", (value, query) => expect(matchesSearch(value, query)).toBe(true));

  it("conserva la ñ como una letra distinta", () => {
    expect(normalizeSearchText("caña")).toBe("caña");
    expect(matchesSearch("caña", "cana")).toBe(false);
  });
});
