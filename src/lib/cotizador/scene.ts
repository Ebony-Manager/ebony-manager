import type { Finish, QuoteLine, QuoteSection, Wall } from "@/types/cotizador";

/**
 * Arma el dibujo 3D de un ítem a partir de sus renglones — puro, sin
 * three.js: devuelve cajas con medidas en metros y el visor
 * (`viewer-3d.tsx`) solo las pinta. Es un esquema ilustrativo de lo
 * cotizado, no un plano de taller.
 *
 * Reglas de acomodo (cuando el usuario no ha arrastrado la pieza):
 *  - Los revestimientos van pegados a la pared, uno al lado del otro.
 *  - Los módulos van delante, de izquierda a derecha; un módulo se apila
 *    sobre el anterior si ese mide hasta 1.05 m de alto.
 *  - Las gavetas se montan en el módulo más bajo; las tablillas, en el
 *    más alto, repartidas parejo; las puertas, en el primer módulo alto.
 *  - Espejos centrados sobre el primer revestimiento; el LED corre por
 *    arriba del mueble y de los paneles.
 *
 * Pared A = la del fondo (eje X). Pared B = a 90° a la derecha de la
 * esquina (`cornerAt`), solo cuando el ítem es "en esquina".
 */

export type SceneMat =
  | { kind: "finish"; finish: Finish | null; dark?: boolean; clear?: boolean; w: number; h: number }
  | { kind: "glass" }
  | { kind: "led" }
  | { kind: "mirror"; tone: "claro" | "bronce" | "gris" }
  /** Lo que se dibuja pero no se cotiza (piedra, TV, A/C, barra de sonido). */
  | { kind: "stone" }
  | { kind: "ref"; tone: "tv" | "ac" | "sound" };

/** Resaltado de una caja en el dibujo de un plano. */
export type BoxState = "selected" | "missing";

export interface SceneBox {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  mat: SceneMat;
  state?: BoxState;
}

export interface SceneGroup {
  lineId: string;
  /** `free` se arrastra por la pared; `hosted` vive dentro de un módulo. */
  kind: "free" | "hosted";
  isModule: boolean;
  /** Pieza de un plano: queda donde dice el plano, no se arrastra. */
  locked?: boolean;
  wall: Wall;
  /** Distancia a lo largo de la pared y altura desde el piso (m). */
  along: number;
  y: number;
  w: number;
  h: number;
  boxes: SceneBox[];
  children: SceneGroup[];
}

export interface Scene {
  groups: SceneGroup[];
  isCorner: boolean;
  cornerAt: number;
  /** Hay renglones sin medidas: su forma es una proporción estimada. */
  approximate: boolean;
  /** Hasta dónde llega lo que hay en la pared A (para proponer la esquina). */
  extentA: number;
}

const T18 = 0.018;
const DEPTH = 0.5;
const Z0 = 0.045;
const GAP = 0.04;

interface Dims {
  w: number;
  h: number;
  n: number;
  approx: boolean;
}

function dimsOf(l: QuoteLine): Dims {
  if (l.mode === "med") {
    return { w: l.width || 0.01, h: l.height || 0.01, n: Math.max(1, Math.round(l.pieces || 1)), approx: false };
  }
  const q = Math.max(0.01, l.qty || 0);
  if (l.unit !== "m2") return { w: q, h: 0.05, n: 1, approx: true };
  const h = Math.min(2.4, Math.max(0.3, Math.sqrt(q * 1.4)));
  return { w: q / h, h, n: 1, approx: true };
}

interface ModuleSlot {
  group: SceneGroup;
  lineId: string;
  lx: number;
  wall: Wall;
  along: number;
  y: number;
  w: number;
  h: number;
  dep: number;
  shelves: { mat: SceneMat; into: SceneGroup }[];
  fronts: number;
  frontH: number;
  doors: boolean;
  topped: boolean;
}

export function buildScene(s: QuoteSection): Scene {
  const isCorner = s.wallShape === "L";
  const cornerAt = isCorner ? Math.max(0.3, s.cornerAt || 0) : 0;
  const groups: SceneGroup[] = [];
  const cur: Record<Wall, { w: number; m: number }> = { A: { w: 0, m: 0 }, B: { w: T18, m: T18 } };
  const mods: ModuleSlot[] = [];
  const walls: { group: SceneGroup; wall: Wall; x: number; y: number; w: number; h: number }[] = [];
  const pending: { l: QuoteLine; d: Dims; wall: Wall }[] = [];
  let approximate = false;

  const fin = (finish: Finish | null, w: number, h: number, dark = false, clear = false): SceneMat => ({
    kind: "finish",
    finish,
    dark,
    clear,
    w,
    h,
  });
  const box = (g: SceneGroup, w: number, h: number, d: number, x: number, y: number, z: number, mat: SceneMat) =>
    g.boxes.push({ w, h, d, x, y, z, mat });
  const battens = (g: SceneGroup, x0: number, y0: number, z0: number, w: number, h: number, bw: number, mat: SceneMat) => {
    const step = bw + 0.02;
    const n = Math.max(1, Math.floor((w + 0.02) / step));
    const off = (w - (n * step - 0.02)) / 2;
    for (let i = 0; i < n; i++) box(g, bw, h, 0.02, x0 + off + i * step, y0, z0, mat);
  };
  const freeGroup = (l: QuoteLine, wall: Wall, w: number, h: number, defAlong: number, defY: number, isModule = false): SceneGroup => {
    const placed = l.posX !== null && l.posY !== null;
    const g: SceneGroup = {
      lineId: l.id,
      kind: "free",
      isModule,
      wall,
      along: placed ? (l.posX as number) : defAlong,
      y: placed ? (l.posY as number) : defY,
      w,
      h,
      boxes: [],
      children: [],
    };
    groups.push(g);
    return g;
  };
  const hostedGroup = (l: QuoteLine, m: ModuleSlot): SceneGroup => {
    const g: SceneGroup = { lineId: l.id, kind: "hosted", isModule: false, wall: m.wall, along: 0, y: 0, w: 0, h: 0, boxes: [], children: [] };
    m.group.children.push(g);
    return g;
  };
  const placed = (l: QuoteLine) => l.posX !== null && l.posY !== null;

  for (const l of s.lines) {
    const f = l.shape;
    if (f === "none") continue;
    const d = dimsOf(l);
    if (d.approx && l.unit === "m2") approximate = true;
    const wall: Wall = isCorner && l.wall === "B" ? "B" : "A";

    if (f === "rev" || f === "rev2" || f === "rev55") {
      const tw = d.n * d.w + (d.n - 1) * GAP;
      const g = freeGroup(l, wall, tw, d.h, cur[wall].w, 0);
      for (let i = 0; i < d.n; i++) {
        const x = i * (d.w + GAP);
        box(g, d.w, d.h, T18, x, 0, 0, fin(l.finish, d.w, d.h));
        if (f !== "rev") battens(g, x, 0, T18, d.w, d.h, f === "rev2" ? 0.02 : 0.055, fin(l.finish, 0.1, d.h, true));
      }
      if (!placed(l)) cur[wall].w += tw + GAP;
      walls.push({ group: g, wall, x: g.along, y: g.y, w: tw, h: d.h });
    } else if (f === "mod") {
      const prev = mods[mods.length - 1];
      const stack =
        !placed(l) && d.n === 1 && !!prev && prev.wall === wall && prev.y === 0 && prev.h <= 1.05 && prev.h + d.h <= 3.2 && !prev.topped;
      const dep = stack ? DEPTH * 0.7 : DEPTH;
      const tw = d.n * d.w + (d.n - 1) * GAP;
      const g = freeGroup(l, wall, tw, d.h, stack ? prev.along + (prev.w - d.w) / 2 : cur[wall].m, stack ? prev.h : 0, true);
      const m = fin(l.finish, d.w, d.h);
      for (let i = 0; i < d.n; i++) {
        const x = i * (d.w + GAP);
        box(g, T18, d.h, dep, x, 0, Z0, m);
        box(g, T18, d.h, dep, x + d.w - T18, 0, Z0, m);
        box(g, d.w - 2 * T18, T18, dep, x + T18, 0, Z0, m);
        box(g, d.w - 2 * T18, T18, dep, x + T18, d.h - T18, Z0, m);
        box(g, d.w - 2 * T18, d.h - 2 * T18, 0.006, x + T18, T18, Z0, fin(l.finish, d.w, d.h, true));
      }
      if (stack) prev.topped = true;
      else if (!placed(l)) cur[wall].m += tw + GAP;
      for (let i = 0; i < d.n; i++) {
        mods.push({
          group: g,
          lineId: l.id,
          lx: i * (d.w + GAP),
          wall,
          along: g.along + i * (d.w + GAP),
          y: g.y,
          w: d.w,
          h: d.h,
          dep,
          shelves: [],
          fronts: 0,
          frontH: 0,
          doors: false,
          topped: false,
        });
      }
    } else {
      pending.push({ l, d, wall });
    }
  }

  const hostOf = (l: QuoteLine) => (l.hostLineId ? mods.find((m) => m.lineId === l.hostLineId) : undefined);
  const tallest = () => mods.slice().sort((a, b) => b.h - a.h)[0];
  const lowest = () => mods.slice().sort((a, b) => a.y - b.y || a.h - b.h)[0];

  for (const { l, d, wall } of pending) {
    const f = l.shape;
    if (f === "tab" || f === "vid") {
      const m = hostOf(l) ?? tallest();
      const mat: SceneMat = f === "vid" ? { kind: "glass" } : fin(l.finish, d.w, 0.4);
      if (m) {
        const into = hostedGroup(l, m);
        const n = f === "vid" && d.approx ? Math.max(1, Math.round((d.w * d.h) / (m.w * m.dep))) : d.n;
        for (let i = 0; i < n; i++) m.shelves.push({ mat, into });
      } else {
        const wl = walls.find((x) => x.wall === wall);
        const g = freeGroup(l, wall, d.w, d.n * 0.38, wl ? wl.x + Math.max(0, (wl.w - d.w) / 2) : cur[wall].w, 1.0);
        for (let i = 0; i < d.n; i++) box(g, d.w, f === "vid" ? 0.01 : 0.025, Math.min(d.h, 0.6), 0, i * 0.38, T18, mat);
      }
    } else if (f === "gav") {
      const m = hostOf(l) ?? lowest();
      const mat = fin(l.finish, d.w, d.h);
      if (m) {
        const into = hostedGroup(l, m);
        const cols = Math.max(1, Math.round(m.w / d.w));
        const fw = m.w / cols;
        for (let i = 0; i < d.n; i++) {
          const k = m.fronts + i;
          box(into, fw - 0.006, d.h - 0.006, T18, m.lx + (k % cols) * fw + 0.003, Math.floor(k / cols) * d.h + 0.003, Z0 + m.dep, mat);
        }
        m.fronts += d.n;
        m.frontH = Math.ceil(m.fronts / cols) * d.h;
      } else {
        const g = freeGroup(l, wall, d.w, d.n * d.h, cur[wall].m, 0);
        for (let i = 0; i < d.n; i++) box(g, d.w, d.h - 0.006, T18, 0, i * d.h, Z0 + DEPTH, mat);
        if (!placed(l)) cur[wall].m += d.w + GAP;
      }
    } else if (f === "pta" || f === "ptaL") {
      const m = hostOf(l) ?? mods.find((x) => !x.doors && x.h > 1.05);
      const mat = fin(l.finish, d.w, d.h, false, !!m);
      const g = m ? hostedGroup(l, m) : freeGroup(l, wall, d.n * d.w, d.h, cur[wall].m, 0);
      const x0 = m ? m.lx : 0;
      const z = m ? Z0 + m.dep : Z0;
      for (let i = 0; i < d.n; i++) {
        box(g, d.w - 0.004, d.h, T18, x0 + i * d.w + 0.002, 0, z, mat);
        if (f === "ptaL") battens(g, x0 + i * d.w, 0, z + T18, d.w, d.h, 0.02, fin(l.finish, 0.1, d.h, true));
      }
      if (m) m.doors = true;
      else if (!placed(l)) cur[wall].m += d.n * d.w + GAP;
    } else if (f === "esp") {
      const wl = walls.find((x) => x.wall === wall);
      const g = freeGroup(
        l,
        wall,
        d.w,
        d.h,
        wl ? wl.x + Math.max(0, (wl.w - d.w) / 2) : cur[wall].w,
        wl ? wl.y + Math.max(0.1, Math.min(wl.h - d.h, 1.5 - d.h / 2)) : 0.8
      );
      const name = l.name.toLowerCase();
      const tone = name.includes("bronce") ? "bronce" : name.includes("claro") ? "claro" : "gris";
      box(g, d.w, d.h, 0.008, 0, 0, T18 + 0.021, { kind: "mirror", tone });
    } else if (f === "led") {
      let rest = d.w;
      const m = hostOf(l) ?? tallest();
      if (m) {
        const len = Math.min(rest, m.w - 2 * T18);
        box(m.group, len, 0.012, 0.012, m.lx + T18, m.h - T18 - 0.014, Z0 + m.dep - 0.03, { kind: "led" });
        rest -= len;
      }
      for (const wl of walls) {
        if (rest <= 0.05) break;
        const len = Math.min(rest, wl.w);
        box(wl.group, len, 0.015, 0.015, 0, wl.h, 0, { kind: "led" });
        rest -= len;
      }
    }
  }

  for (const m of mods) {
    const n = m.shelves.length;
    const lo = m.frontH + T18;
    const hi = m.h - T18;
    m.shelves.forEach((sh, i) =>
      box(sh.into, m.w - 2 * T18, sh.mat.kind === "glass" ? 0.01 : T18, m.dep - 0.03, m.lx + T18, lo + ((hi - lo) * (i + 1)) / (n + 1), Z0 + 0.006, sh.mat)
    );
  }

  const extentA = Math.max(1, ...groups.filter((g) => g.wall === "A").map((g) => g.along + g.w));
  return { groups, isCorner, cornerAt, approximate, extentA };
}
