import { describe, expect, it } from "vitest";
import { hasAnyModule, hasModule, hasModules, homePathFor, normalizeModules } from "./modules";

describe("normalizeModules", () => {
  it("quita repetidos y claves desconocidas, y ordena como APP_MODULES", () => {
    expect(normalizeModules(["planilla", "x", "cotizacion", "planilla", 3])).toEqual(["cotizacion", "planilla"]);
  });

  it("descarta un sub-permiso sin su módulo padre", () => {
    expect(normalizeModules(["asistencia"])).toEqual([]);
    expect(normalizeModules(["costos", "planilla"])).toEqual(["planilla"]);
    expect(normalizeModules(["asistencia", "planilla"])).toEqual(["planilla", "asistencia"]);
  });
});

describe("hasModule", () => {
  it("el admin entra a todo aunque no tenga módulos", () => {
    expect(hasModule({ role: "admin", modules: [] }, "planilla")).toBe(true);
  });

  it("un usuario solo entra a lo asignado", () => {
    const u = { role: "vendedor", modules: ["cotizacion"] };
    expect(hasModule(u, "cotizacion")).toBe(true);
    expect(hasModule(u, "planilla")).toBe(false);
    expect(hasModule(null, "cotizacion")).toBe(false);
  });

  it("un sub-permiso guardado sin su padre no da acceso", () => {
    expect(hasModule({ role: "vendedor", modules: ["asistencia"] }, "asistencia")).toBe(false);
  });

  it("hasModules pide todos", () => {
    const u = { role: "vendedor", modules: ["planilla"] };
    expect(hasModules(u, ["planilla"])).toBe(true);
    expect(hasModules(u, ["planilla", "contratistas"])).toBe(false);
  });

  it("hasAnyModule pide al menos uno", () => {
    const u = { role: "vendedor", modules: ["contratistas"] };
    expect(hasAnyModule(u, ["planilla", "contratistas"])).toBe(true);
    expect(hasAnyModule(u, ["planilla", "cotizacion"])).toBe(false);
    expect(hasAnyModule({ role: "admin", modules: [] }, ["planilla"])).toBe(true);
  });
});

describe("homePathFor", () => {
  it("lleva al primer módulo disponible", () => {
    expect(homePathFor({ role: "admin", modules: [] })).toBe("/cotizacion");
    expect(homePathFor({ role: "vendedor", modules: ["contratistas", "planilla"] })).toBe("/planilla");
    expect(homePathFor({ role: "vendedor", modules: ["contratistas"] })).toBe("/contratistas");
  });

  it("sin módulos cae en una pantalla abierta a todos", () => {
    expect(homePathFor({ role: "vendedor", modules: [] })).toBe("/dashboard");
    expect(homePathFor(null)).toBe("/dashboard");
  });
});
