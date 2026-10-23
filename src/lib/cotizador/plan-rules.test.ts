import { describe, expect, it } from "vitest";

import { DEFAULT_ANSWERS, type PlanPiece } from "@/types/plan";
import { SEED_ITEMS } from "./catalog-seed";
import { THE_WOODS } from "./plan-fixtures";
import { coverage, piecesToLines, planDescription } from "./plan-rules";

// Referencia: la cotización del Mueble Family (The Woods 10-32) tal como
// la armó la cotizadora en la app, con sus reglas de medición.
const qtyOf = (code: string) => piecesToLines(THE_WOODS.pieces, DEFAULT_ANSWERS).lines.find((l) => l.code === code)?.qty;

describe("piecesToLines — The Woods", () => {
  it.each([
    ["mod-ag", 5.37, "módulo: 4.57 × 0.57 + 3.67 × 0.72 + gaveta 0.90 × 0.14"],
    ["pta-pi", 3.67, "puertas lisas: 2 × (0.90 × 0.57) + 3.67 × 0.72"],
    ["pta-pi-l", 1.46, "rejilla: 2.57 × 0.57"],
    ["gav-fr-pi", 0.13, "frente de gaveta 0.90 × 0.14"],
    ["gav-es-ag", 0.9, "estructura de gaveta, ML"],
    ["gav-go-ag", 0.9, "gola de la gaveta, ML"],
    ["ac-riel-e", 1, "un par de rieles por gaveta"],
    ["ac-bis-r", 24, "10 hojas × 2 + rejilla 4"],
    ["ac-brazo", 2, "un par de brazos para la rejilla"],
    ["tab-ag", 1.47, "tablillas internas 3.67 × 0.40"],
    ["ac-sop-tab", 24, "4 soportes por tramo × 6"],
    ["tab-pi", 5.31, "columnas: 4 × 2.95 × 0.45"],
    ["rev-pi", 10.78, "panelados: laterales, fondo de TV, fondos de nichos, panel bajo gaveta"],
  ])("%s = %s (%s)", (code, expected) => {
    expect(qtyOf(code)).toBe(expected);
  });

  it("no cobra piedra, TV ni A/C", () => {
    const r = piecesToLines(THE_WOODS.pieces, DEFAULT_ANSWERS);
    const codes = r.lines.map((l) => l.code);
    expect(codes).not.toContain("sb-led");
    expect(r.excluded.filter((e) => e.reason === "piedra")).toHaveLength(7);
    expect(r.excluded.map((e) => e.pieceId)).toEqual(expect.arrayContaining(["ref-tv", "ref-ac", "pie-tir"]));
  });

  it("todos los códigos existen en el catálogo", () => {
    const codes = new Set([...SEED_ITEMS.map((i) => i.code), "ac-sop-tab"]);
    const r = piecesToLines(THE_WOODS.pieces, { ...DEFAULT_ANSWERS, ledMl: 4, metalMl: 3.6 });
    for (const l of r.lines) expect(codes.has(l.code), l.code).toBe(true);
  });

  it("agrega LED y estructura metálica del cuestionario", () => {
    const r = piecesToLines(THE_WOODS.pieces, { ...DEFAULT_ANSWERS, ledMl: 4.5, metalMl: 3.6 });
    expect(r.lines.find((l) => l.code === "sb-led")?.qty).toBe(4.5);
    expect(r.lines.find((l) => l.code === "sb-est")?.qty).toBe(3.6);
  });

  it("cubre el 100% del mueble", () => {
    const r = piecesToLines(THE_WOODS.pieces, DEFAULT_ANSWERS);
    const covered = new Set(r.lines.flatMap((l) => l.pieceIds));
    expect(coverage(THE_WOODS.pieces, covered)).toEqual({ pct: 100, missing: [] });
  });

  it("avisa qué falta si un renglón se borra", () => {
    const r = piecesToLines(THE_WOODS.pieces, DEFAULT_ANSWERS);
    const covered = new Set(r.lines.filter((l) => l.code !== "tab-pi").flatMap((l) => l.pieceIds));
    const c = coverage(THE_WOODS.pieces, covered);
    expect(c.missing.map((p) => p.kind)).toEqual(["column", "column", "column", "column"]);
    expect(c.pct).toBeLessThan(100);
  });

  it("redacta la descripción con lo que no incluye", () => {
    const text = planDescription(THE_WOODS.pieces, DEFAULT_ANSWERS);
    expect(text).toContain("melamina hidrófuga para interno");
    expect(text).toContain("sistema de apertura gola");
    expect(text).toContain("No incluye sobre de piedra, tablillas de piedra, tiradores de piedra, TV ni aire acondicionado.");
  });
});

describe("piecesToLines — reglas sueltas", () => {
  const door = (p: Partial<PlanPiece>): PlanPiece => ({ id: "d", kind: "door", label: "", section: 1, x: 0, y: 0, w: 0.5, h: 0.7, d: 0.02, confidence: "alta", ...p });
  const lines = (pieces: PlanPiece[], a = DEFAULT_ANSWERS) => Object.fromEntries(piecesToLines(pieces, a).lines.map((l) => [l.code, l.qty]));

  it("una puerta de más de 1 m de alto lleva 4 bisagras", () => {
    expect(lines([door({ h: 2.4, leaves: [0.5, 0.5], w: 1 })])["ac-bis-r"]).toBe(8);
  });
  it("con apertura push lleva expulsores en vez de gola", () => {
    expect(lines([door({ leaves: [0.5, 0.5], w: 1 })], { ...DEFAULT_ANSWERS, opening: "push" })["ac-exp"]).toBe(2);
  });
  it("detrás de puertas de vidrio el módulo va en el acabado externo", () => {
    const mod: PlanPiece = { id: "m", kind: "module", label: "", section: 1, x: 0, y: 0, w: 1, h: 2, d: 0.45, confidence: "alta" };
    const out = lines([mod, door({ material: "glass", w: 1, h: 2 })]);
    expect(out["mod-pi"]).toBe(2);
    expect(out["mod-ag"]).toBeUndefined();
  });
  it("las tablillas vistas van en el acabado externo y las internas en aglomerado", () => {
    const shelf = (visible: boolean): PlanPiece => ({ id: String(visible), kind: "shelf", label: "", section: 1, x: 0, y: 0, w: 1, h: 0.02, d: 0.4, visible, confidence: "alta" });
    const out = lines([shelf(true), shelf(false)], { ...DEFAULT_ANSWERS, exteriorFinish: "chapilla" });
    expect(out["tab-ch"]).toBe(0.4);
    expect(out["tab-ag"]).toBe(0.4);
  });
});
