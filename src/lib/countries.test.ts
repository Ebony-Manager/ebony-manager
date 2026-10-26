import { describe, expect, it } from "vitest";
import { COMMON_COUNTRIES, COUNTRY_CODES, countryCodeFromName, countryName, countryOptions, isCountryCode } from "./countries";

describe("countries", () => {
  it("muestra el país en el idioma de la app", () => {
    expect(countryName("PA", "es")).toBe("Panamá");
    expect(countryName("PA", "en")).toBe("Panama");
    expect(countryName("CO", "es")).toBe("Colombia");
  });

  it("deja tal cual un texto viejo que no es código, y vacío si no hay", () => {
    expect(countryName("Panameño", "es")).toBe("Panameño");
    expect(countryName(null, "es")).toBe("");
    expect(isCountryCode("Panameño")).toBe(false);
  });

  it("lista los frecuentes primero, sin repetir, y el resto por nombre", () => {
    const opts = countryOptions("es");
    expect(opts.slice(0, COMMON_COUNTRIES.length).map((o) => o.code)).toEqual([...COMMON_COUNTRIES]);
    expect(new Set(opts.map((o) => o.code)).size).toBe(COUNTRY_CODES.length);
    const rest = opts.filter((o) => !o.common).map((o) => o.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
  });

  it("reconoce el país por su nombre en español o inglés", () => {
    expect(countryCodeFromName("Panama")).toBe("PA");
    expect(countryCodeFromName("panamá ")).toBe("PA");
    expect(countryCodeFromName("Venezuela")).toBe("VE");
    expect(countryCodeFromName("República Dominicana")).toBe("DO");
    expect(countryCodeFromName("co")).toBe("CO");
    expect(countryCodeFromName("Narnia")).toBeNull();
    expect(countryCodeFromName("")).toBeNull();
  });
});
