import { describe, expect, it } from "vitest";
import { hasAnyModule, hasModule, hasModules, homePathFor, normalizeModules } from "./modules";

describe("normalizeModules", () => {
  it("quita repetidos y claves desconocidas, y ordena como APP_MODULES", () => {
    expect(normalizeModules(["planilla", "x", "cotizacion", "documentos", "planilla", 3])).toEqual(["cotizacion", "documentos", "planilla"]);
  });

  it("descarta un sub-permiso sin su módulo padre", () => {
    expect(normalizeModules(["asistencia"])).toEqual([]);
    expect(normalizeModules(["costos", "documentos", "planilla"])).toEqual(["documentos", "planilla"]);
    expect(normalizeModules(["asistencia", "planilla", "documentos"])).toEqual(["documentos", "planilla", "asistencia"]);
  });

  it("Planilla y Contratistas viven dentro de Personal (y Asistencia dentro de Planilla)", () => {
    expect(normalizeModules(["planilla", "contratistas"])).toEqual([]);
    expect(normalizeModules(["asistencia", "planilla"])).toEqual([]);
    expect(normalizeModules(["documentos", "contratistas"])).toEqual(["documentos", "contratistas"]);
  });

  it("Compras, Costos y Ajustes viven dentro de Almacén", () => {
    expect(normalizeModules(["almacen_compras", "almacen_costos", "almacen_ajustes"])).toEqual([]);
    expect(normalizeModules(["almacen_ajustes", "almacen"])).toEqual(["almacen", "almacen_ajustes"]);
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
    const u = { role: "vendedor", modules: ["documentos", "planilla"] };
    expect(hasModules(u, ["planilla"])).toBe(true);
    expect(hasModules(u, ["planilla", "contratistas"])).toBe(false);
  });

  it("hasAnyModule pide al menos uno", () => {
    const u = { role: "vendedor", modules: ["documentos", "contratistas"] };
    expect(hasAnyModule(u, ["planilla", "contratistas"])).toBe(true);
    expect(hasAnyModule(u, ["planilla", "cotizacion"])).toBe(false);
    expect(hasAnyModule({ role: "admin", modules: [] }, ["planilla"])).toBe(true);
  });
});

describe("homePathFor", () => {
  it("lleva al primer módulo disponible", () => {
    expect(homePathFor({ role: "admin", modules: [] })).toBe("/cotizacion");
    expect(homePathFor({ role: "vendedor", modules: ["documentos", "contratistas", "planilla"] })).toBe("/personal/pagos");
    expect(homePathFor({ role: "vendedor", modules: ["documentos", "contratistas"] })).toBe("/personal/pagos");
    expect(homePathFor({ role: "vendedor", modules: ["documentos"] })).toBe("/personal/staff");
    expect(homePathFor({ role: "vendedor", modules: ["almacen", "almacen_compras"] })).toBe("/almacen");
  });

  it("sin módulos cae en una pantalla abierta a todos", () => {
    expect(homePathFor({ role: "vendedor", modules: [] })).toBe("/dashboard");
    expect(homePathFor(null)).toBe("/dashboard");
  });
});
