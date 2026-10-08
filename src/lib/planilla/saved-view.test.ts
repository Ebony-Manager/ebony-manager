import { describe, expect, it } from "vitest";

import { parseSavedView, pickBool, pickBoolRecord, pickEnum, sessionView } from "./saved-view";

const sanitize = (o: Record<string, unknown>) => ({ palette: pickEnum(o.palette, ["full", "sober"] as const, "full") });

describe("parseSavedView", () => {
  it("lee una vista válida", () => {
    expect(parseSavedView(JSON.stringify({ v: 1, palette: "sober" }), sanitize)).toEqual({ palette: "sober" });
  });
  it("null / vacío / JSON roto / no-objeto -> null", () => {
    expect(parseSavedView(null, sanitize)).toBeNull();
    expect(parseSavedView("", sanitize)).toBeNull();
    expect(parseSavedView("{no json", sanitize)).toBeNull();
    expect(parseSavedView("[1,2]", sanitize)).toBeNull();
    expect(parseSavedView("42", sanitize)).toBeNull();
  });
  it("otra versión -> null (se ignora, no se interpreta)", () => {
    expect(parseSavedView(JSON.stringify({ v: 2, palette: "sober" }), sanitize)).toBeNull();
    expect(parseSavedView(JSON.stringify({ palette: "sober" }), sanitize)).toBeNull();
  });
  it("valor inválido cae al default", () => {
    expect(parseSavedView(JSON.stringify({ v: 1, palette: "neon" }), sanitize)).toEqual({ palette: "full" });
  });
});

describe("pickBoolRecord", () => {
  const defaults = { a: true, b: true, c: false };
  it("respeta lo guardado, rellena lo que falta, ignora lo desconocido y lo no booleano", () => {
    expect(pickBoolRecord({ a: false, c: "x", z: true }, defaults)).toEqual({ a: false, b: true, c: false });
  });
  it("entrada inválida -> defaults", () => {
    expect(pickBoolRecord(null, defaults)).toEqual(defaults);
    expect(pickBoolRecord("hola", defaults)).toEqual(defaults);
  });
});

describe("pickBool", () => {
  it("solo acepta booleanos", () => {
    expect(pickBool(false, true)).toBe(false);
    expect(pickBool("false", true)).toBe(true);
  });
});

describe("sessionView", () => {
  it("guarda, lee y borra por clave", () => {
    sessionView.set("k", { x: 1 });
    expect(sessionView.get("k")).toEqual({ x: 1 });
    sessionView.clear("k");
    expect(sessionView.get("k")).toBeUndefined();
  });
});
