import { describe, expect, it } from "vitest";
import { tidyCase } from "./text";

describe("tidyCase", () => {
  it("pasa a formato normal lo que viene todo en mayúsculas", () => {
    expect(tidyCase("MUEBLE DE CENTRO DE LAVADO")).toBe("Mueble de centro de lavado");
    expect(tidyCase("REC. SECUNDARIA")).toBe("Rec. secundaria");
    expect(tidyCase("MUEBLE TV + PANELADO")).toBe("Mueble TV + panelado");
    expect(tidyCase("  CLOSET  ")).toBe("Closet");
  });
  it("respeta lo que ya viene escrito normal y las siglas", () => {
    expect(tidyCase("Panelado Columnas")).toBe("Panelado Columnas");
    expect(tidyCase("Mueble TV")).toBe("Mueble TV");
    expect(tidyCase("DEN")).toBe("Den");
    expect(tidyCase("TV")).toBe("TV");
  });
});
