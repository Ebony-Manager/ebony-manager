import { describe, expect, it } from "vitest";

import { splitName } from "./split-name";

describe("splitName", () => {
  it("dos palabras: nombre y apellido", () => {
    expect(splitName("Karina Cardona")).toEqual({ first: "Karina", last: "Cardona" });
  });
  it("tres palabras: dos nombres y un apellido", () => {
    expect(splitName("Nabil Massiel Soriano")).toEqual({ first: "Nabil Massiel", last: "Soriano" });
  });
  it("cuatro o más: los dos últimos son el apellido", () => {
    expect(splitName("María José Pérez Gómez")).toEqual({ first: "María José", last: "Pérez Gómez" });
  });
  it("una sola palabra o vacío", () => {
    expect(splitName("Breiner")).toEqual({ first: "Breiner", last: "" });
    expect(splitName("  ")).toEqual({ first: "", last: "" });
  });
});
