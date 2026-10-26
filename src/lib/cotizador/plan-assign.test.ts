import { describe, expect, it } from "vitest";

import type { CatalogItem, QuotePlan } from "@/types/cotizador";
import { DEFAULT_ANSWERS } from "@/types/plan";
import { SEED_INPUTS, SEED_ITEMS } from "./catalog-seed";
import { metraje } from "./metraje";
import { quoteMissing, togglePiece } from "./plan-assign";
import { THE_WOODS } from "./plan-fixtures";
import { buildPlanSection } from "./plan-section";
import { defaultsFromInputs, newLine } from "./pricing";
import { coverage } from "./plan-rules";

const catalog: CatalogItem[] = [...SEED_ITEMS, { code: "ac-sop-tab", category: "accesorios", finish: null, name: "Soporte de tablilla", unit: "unidad", price: 0.2, shape: "none", sortOrder: 455, recipe: null } as const].map(
  (s) => ({ id: s.code, code: s.code, category: s.category, finish: s.finish, name: s.name, unit: s.unit, price: s.price, shape: s.shape, active: true, sortOrder: s.sortOrder })
);
const plan: QuotePlan = { id: "plan", fileName: "", filePath: null, source: "ejemplo", title: THE_WOODS.title, pieces: THE_WOODS.pieces, answers: DEFAULT_ANSWERS, doubts: [] };
let n = 0;
const newId = () => `id${n++}`;
const base = buildPlanSection({ sectionId: "s", newId, reading: THE_WOODS, answers: DEFAULT_ANSWERS, catalog, defaults: defaultsFromInputs(SEED_INPUTS), location: "", name: "Family" }).section;
const covered = (s: typeof base) => coverage(plan.pieces, new Set(s.lines.flatMap((l) => l.pieceIds)));

describe("quoteMissing", () => {
  it("vuelve a cotizar las columnas después de borrar su renglón", () => {
    const without = { ...base, lines: base.lines.filter((l) => l.itemId !== "tab-pi") };
    expect(covered(without).missing).toHaveLength(4);
    const fixed = quoteMissing(without, plan, catalog, newId);
    expect(covered(fixed).pct).toBe(100);
    expect(fixed.lines.find((l) => l.itemId === "tab-pi")?.qty).toBe(5.31);
  });

  it("suma al renglón existente del mismo ítem en vez de duplicarlo", () => {
    const panels = base.lines.find((l) => l.itemId === "rev-pi")!;
    const partial = { ...base, lines: base.lines.map((l) => (l === panels ? { ...l, qty: 2.5665, pieceIds: ["pan-s1"] } : l)) };
    const fixed = quoteMissing(partial, plan, catalog, newId);
    const rev = fixed.lines.filter((l) => l.itemId === "rev-pi");
    expect(rev).toHaveLength(1);
    expect(rev[0].qty).toBe(10.8);
  });

  it("no agrega LED ni estructura metálica (no son de una pieza)", () => {
    const fixed = quoteMissing({ ...base, lines: [] }, { ...plan, answers: { ...DEFAULT_ANSWERS, ledMl: 5 } }, catalog, newId);
    expect(fixed.lines.some((l) => l.itemId === "sb-led")).toBe(false);
  });
});

describe("togglePiece", () => {
  it("asignar las 4 columnas a una tablilla pintada nueva da 5.31 m²", () => {
    const line = { ...newLine("nueva", catalog.find((c) => c.code === "tab-pi")!), pieceIds: [] };
    let s = { ...base, lines: [...base.lines.filter((l) => l.itemId !== "tab-pi"), line] };
    for (const id of ["col-1", "col-2", "col-3", "col-4"]) s = togglePiece(s, "nueva", id, plan, catalog);
    const l = s.lines.find((x) => x.id === "nueva")!;
    expect(l.mode).toBe("dir");
    expect(l.qty).toBe(5.31);
    expect(covered(s).pct).toBe(100);
    s = togglePiece(s, "nueva", "col-4", plan, catalog);
    expect(s.lines.find((x) => x.id === "nueva")?.qty).toBe(3.98);
  });
});

describe("metraje", () => {
  it("separa pintado, aglomerado y piedra", () => {
    const m = metraje(base, plan);
    const f = Object.fromEntries(m.byFinish.map((r) => [r.key, r.qty]));
    // pintado: panelado 10.80 + tablillas/columnas 5.31 + puertas 3.67 + rejilla 1.46 + frente gaveta 0.13
    expect(f.pintado).toBe(21.37);
    // aglomerado: módulos 5.37 + tablillas internas 1.38
    expect(f.aglomerado).toBe(6.75);
    expect(m.stoneM2).toBeCloseTo(4 * 0.86 * 0.3 + (0.9 + 2.57 + 0.9) * 0.43, 2);
    const w = Object.fromEntries(m.byWork.filter((r) => r.unit === "m2").map((r) => [r.key, r.qty]));
    expect(w.modulos).toBe(5.37);
    expect(w.panelado).toBe(10.8);
    expect(m.hardware.find((r) => r.key === "Bisagra recta")?.qty).toBe(22);
  });
});

describe("gola en un ítem leído de plano", () => {
  it("la gola de la gaveta va dentro del frente, no como renglón suelto", () => {
    expect(base.lines.some((l) => l.itemId === "gav-go-ag")).toBe(false);
    const front = base.lines.find((l) => l.itemId === "gav-fr-pi")!;
    expect(front.golaMl).toBe(0.9);
    expect(front.golaPrice).toBe(11.2);
  });
});
