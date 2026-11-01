import { describe, expect, it } from "vitest";

import { cleanAreaName, foldArea, sameArea, similarAreas } from "./areas";

describe("áreas", () => {
  const areas = ["Recámara principal", "Recámara secundaria 1", "Den", "Sala", "Oficina Claudia"];

  it("limpia y compara sin mayúsculas, acentos, signos ni abreviaturas", () => {
    expect(cleanAreaName("  Den   familiar ")).toBe("Den familiar");
    expect(foldArea("Rec. Principal")).toBe("recamara principal");
    expect(sameArea("recamara  PRINCIPAL", areas)).toBe("Recámara principal");
    expect(sameArea("Rec. principal", areas)).toBe("Recámara principal");
    expect(sameArea("Cocina", areas)).toBeNull();
  });

  it("sugiere las parecidas antes de crear otra", () => {
    expect(similarAreas("Recamara princpal", areas)).toEqual(["Recámara principal"]);
    expect(similarAreas("Oficina", areas)).toEqual(["Oficina Claudia"]);
    expect(similarAreas("Den familiar", areas)).toEqual(["Den"]);
    expect(similarAreas("Cocina", areas)).toEqual([]);
    expect(similarAreas("Sa", areas)).toEqual([]);
  });
});
