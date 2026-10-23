import type { Finish } from "@/types/cotizador";
import type { PlanPiece } from "@/types/plan";
import type { BoxState, Scene, SceneBox, SceneGroup, SceneMat } from "./scene";

/**
 * Dibujo 3D exacto de un mueble leído de un plano: cada pieza va donde
 * dice el plano (no hay acomodo automático ni arrastre). Lo que no se
 * cotiza (piedra, TV, A/C) se dibuja igual, en gris, para que el mueble
 * se entienda.
 *
 * `selected` resalta las piezas de un renglón; `missing` marca las que
 * ningún renglón cubre; `interior` esconde puertas y frentes de gaveta
 * para ver módulos y tablillas internas.
 */
export function buildPlanScene(
  pieces: PlanPiece[],
  {
    finish,
    selected = new Set<string>(),
    missing = new Set<string>(),
    interior = false,
  }: { finish: Exclude<Finish, "blanco">; selected?: Set<string>; missing?: Set<string>; interior?: boolean }
): Scene {
  // Fondo del mueble: lo que traen los módulos y columnas (0.45 en The Woods).
  const depth = Math.max(0.3, ...pieces.filter((p) => p.kind === "module" || p.kind === "column").map((p) => p.d));
  const T = 0.018;
  const groups: SceneGroup[] = [];

  const ext = (w: number, h: number, dark = false): SceneMat => ({ kind: "finish", finish, w, h, dark });
  const inner = (w: number, h: number): SceneMat => ({ kind: "finish", finish: "blanco", w, h });

  for (const p of pieces) {
    if (interior && (p.kind === "door" || p.kind === "drawer")) continue;
    if (p.kind === "reference" && p.w < 0.1) continue; // tiradores sueltos: no se dibujan
    const state: BoxState | undefined = selected.has(p.id) ? "selected" : missing.has(p.id) ? "missing" : undefined;
    const boxes: SceneBox[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: SceneMat) => boxes.push({ w, h, d, x, y, z, mat, state });
    const stone = p.material === "stone";

    switch (p.kind) {
      case "panel":
        box(p.w, p.h, T, 0, 0, 0, ext(p.w, p.h));
        if (p.slats) slats(box, p.w, p.h, T, p.slats, ext(0.1, p.h, true));
        break;
      case "module": {
        // Caparazón en melamina: fondo, piso, techo y costados.
        const d = Math.min(p.d, depth);
        const m = inner(p.w, p.h);
        box(p.w, p.h, 0.006, 0, 0, T, m);
        box(p.w, T, d - T, 0, 0, T, m);
        box(p.w, T, d - T, 0, p.h - T, T, m);
        box(T, p.h, d - T, 0, 0, T, m);
        box(T, p.h, d - T, p.w - T, 0, T, m);
        break;
      }
      case "door": {
        const leaves = p.leaves?.length ? p.leaves : [p.w];
        const total = leaves.reduce((a, b) => a + b, 0);
        const gap = leaves.length > 0 ? Math.max(0, (p.w - total) / (leaves.length + 1)) : 0;
        let x = gap;
        for (const lw of leaves) {
          box(lw - 0.004, p.h - 0.004, T, x + 0.002, 0.002, depth, ext(lw, p.h));
          if (p.slats) slats(box, lw, p.h, depth + T, p.slats, ext(0.1, p.h, true), x);
          x += lw + gap;
        }
        break;
      }
      case "drawer":
        box(p.w - 0.004, p.h - 0.004, T, 0.002, 0.002, depth, ext(p.w, p.h));
        break;
      case "shelf":
        box(p.w, Math.max(0.018, p.h), p.d, 0, 0, T, stone ? { kind: "stone" } : p.visible ? ext(p.w, p.d) : inner(p.w, p.d));
        break;
      case "column":
        box(p.w, p.h, p.d, 0, 0, T, ext(p.w, p.h));
        break;
      case "countertop":
        box(p.w, p.h, p.d, 0, 0, T, stone ? { kind: "stone" } : ext(p.w, p.d));
        break;
      case "reference":
        box(p.w, p.h, p.d, 0, 0, p.ref === "ac" ? T : depth + 0.08, { kind: "ref", tone: p.ref ?? "tv" });
        break;
    }
    groups.push({ lineId: p.id, kind: "free", isModule: p.kind === "module", locked: true, wall: "A", along: p.x, y: p.y, w: p.w, h: p.h, boxes, children: [] });
  }
  const extentA = Math.max(1, ...pieces.map((p) => p.x + p.w));
  return { groups, isCorner: false, cornerAt: 0, approximate: false, extentA };
}

function slats(
  box: (w: number, h: number, d: number, x: number, y: number, z: number, mat: SceneMat) => void,
  w: number,
  h: number,
  z: number,
  width: number,
  mat: SceneMat,
  x0 = 0
) {
  const step = width + 0.02;
  const n = Math.max(1, Math.floor((w + 0.02) / step));
  const off = (w - (n * step - 0.02)) / 2;
  for (let i = 0; i < n; i++) box(width, h, 0.02, x0 + off + i * step, 0, z, mat);
}
