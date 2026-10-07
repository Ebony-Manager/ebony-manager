import { describe, expect, it } from "vitest";

import { matchesEmployeeQuery, numberEmployees } from "./employee-search";

describe("matchesEmployeeQuery", () => {
  it("búsqueda vacía o en blanco -> todos", () => {
    expect(matchesEmployeeQuery("Mario Loaiza", "")).toBe(true);
    expect(matchesEmployeeQuery("Mario Loaiza", "   ")).toBe(true);
  });
  it("ignora mayúsculas y acentos", () => {
    expect(matchesEmployeeQuery("José Salcedo", "jose")).toBe(true);
    expect(matchesEmployeeQuery("Jose Salcedo", "JOSÉ")).toBe(true);
    expect(matchesEmployeeQuery("Edwin Villafañe", "villafane")).toBe(true);
  });
  it("coincide por fragmento y sin importar el orden de las palabras", () => {
    expect(matchesEmployeeQuery("Mario Loaiza", "loa")).toBe(true);
    expect(matchesEmployeeQuery("Mario Loaiza", "loaiza mario")).toBe(true);
  });
  it("todas las palabras deben estar", () => {
    expect(matchesEmployeeQuery("Mario Loaiza", "mario perez")).toBe(false);
    expect(matchesEmployeeQuery("Mario Loaiza", "zzz")).toBe(false);
  });
});

describe("numberEmployees", () => {
  it("numera desde 1 según el orden recibido", () => {
    const n = numberEmployees(["a", "b", "c"]);
    expect(n.get("a")).toBe(1);
    expect(n.get("c")).toBe(3);
  });
});
