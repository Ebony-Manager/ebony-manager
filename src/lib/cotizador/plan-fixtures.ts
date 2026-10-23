import type { PlanPiece, PlanReading } from "@/types/plan";

/**
 * Lectura de referencia: "Mueble Family", The Woods 10-32 (Proyecto
 * Estudio, sep 2026). Hecha a mano a partir del plano, con las reglas de
 * la cotizadora (siempre la medida más grande; módulo con ancho general).
 * Sirve para dos cosas: probar las reglas (`plan-rules.test.ts`) y
 * probar todo el flujo de "Leer plano" mientras no hay llave de la API.
 *
 * Secciones verticales, de izquierda a derecha:
 *   1 panelado lateral (0.87) · 2 mueble de tablillas izq. (0.90)
 *   3 mueble de TV (2.57) · 4 mueble de tablillas der. (0.90)
 *   5 panelado lateral (0.27); entre ellas, 4 columnas de 0.05.
 */

const X = { s1: 0, c1: 0.87, s2: 0.92, c2: 1.82, s3: 1.87, c3: 4.44, s4: 4.49, c4: 5.39, s5: 5.44 };
const TOP_Y = 2.38; // zona superior de 0.57 hasta 2.95
const NICHE_Y = 0.79; // nichos de 1.58 sobre el sobre de piedra
const pz = (p: Omit<PlanPiece, "confidence"> & { confidence?: PlanPiece["confidence"] }): PlanPiece => ({ confidence: "alta", ...p });

const pieces: PlanPiece[] = [
  // Panelados
  // El plano acota 2.93 en el panel y 2.95 en el mueble: se usa la más grande.
  pz({ id: "pan-s1", kind: "panel", label: "Panelado lateral izquierdo", section: 1, x: X.s1, y: 0, w: 0.87, h: 2.95, d: 0.018 }),
  pz({ id: "pan-s5", kind: "panel", label: "Panelado lateral derecho", section: 5, x: X.s5, y: 0, w: 0.27, h: 2.95, d: 0.018 }),
  pz({ id: "pan-tv", kind: "panel", label: "Fondo de la TV", section: 3, x: X.s3, y: NICHE_Y, w: 2.57, h: 1.58, d: 0.018 }),
  pz({ id: "pan-n2", kind: "panel", label: "Fondo de nichos izquierdo", section: 2, x: X.s2, y: NICHE_Y, w: 0.9, h: 1.58, d: 0.018 }),
  pz({ id: "pan-n4", kind: "panel", label: "Fondo de nichos derecho", section: 4, x: X.s4, y: NICHE_Y, w: 0.9, h: 1.58, d: 0.018 }),
  pz({ id: "pan-g4", kind: "panel", label: "Panel bajo la gaveta", section: 4, x: X.s4, y: 0, w: 0.9, h: 0.59, d: 0.018 }),

  // Columnas
  ...[X.c1, X.c2, X.c3, X.c4].map((x, i) =>
    pz({ id: `col-${i + 1}`, kind: "column", label: `Columna ${i + 1}`, section: i < 2 ? i + 2 : i + 1, x, y: 0, w: 0.05, h: 2.95, d: 0.45 })
  ),

  // Módulos (caparazón interno, ancho general)
  pz({ id: "mod-sup", kind: "module", label: "Módulo superior", section: 3, x: X.c1, y: TOP_Y, w: 4.57, h: 0.57, d: 0.45 }),
  pz({ id: "mod-inf", kind: "module", label: "Módulo inferior", section: 3, x: X.c1, y: 0, w: 3.67, h: 0.72, d: 0.45 }),

  // Puertas
  pz({ id: "pta-sup-2", kind: "door", label: "Puertas superiores izquierda", section: 2, x: X.s2, y: TOP_Y, w: 0.9, h: 0.57, d: 0.018, leaves: [0.45, 0.45], opening: "gola" }),
  pz({ id: "pta-sup-4", kind: "door", label: "Puertas superiores derecha", section: 4, x: X.s4, y: TOP_Y, w: 0.9, h: 0.57, d: 0.018, leaves: [0.45, 0.45], opening: "gola", confidence: "media", notes: "El plano dice 0.49 y 0.53; se usa 0.57, la más grande del mueble." }),
  pz({
    id: "pta-rejilla",
    kind: "door",
    label: "Rejilla abatible del A/C",
    section: 3,
    x: X.s3,
    y: TOP_Y,
    w: 2.57,
    h: 0.57,
    d: 0.018,
    leaves: [2.57],
    slats: 0.02,
    opening: "arriba",
    confidence: "media",
    notes: "Listones MDF 0.02 × 0.02, separación 0.02. Abre hacia arriba (confirmar con las arquitectas).",
  }),
  pz({ id: "pta-inf", kind: "door", label: "Puertas inferiores", section: 3, x: X.c1, y: 0, w: 3.67, h: 0.72, d: 0.018, leaves: [0.45, 0.45, 0.65, 0.63, 0.63, 0.65], opening: "gola" }),

  // Gaveta
  pz({ id: "gav-4", kind: "drawer", label: "Gaveta", section: 4, x: X.s4, y: 0.58, w: 0.9, h: 0.14, d: 0.43, opening: "gola", notes: "Tirador a 45°." }),

  // Tablillas internas (detrás de las puertas inferiores)
  // Ancho real de las hojas: 0.45 + 0.45 + 0.65 + 0.63 + 0.63 + 0.65 = 3.46.
  pz({ id: "tab-int", kind: "shelf", label: "Tablillas internas", section: 3, x: X.s2, y: 0.36, w: 3.46, h: 0.02, d: 0.4, visible: false, segments: 6, confidence: "media", notes: "Una por cada hoja de puerta, con el ancho de las hojas." }),

  // Piedra (no se cotiza)
  ...[
    { id: "pie-t2a", x: X.s2, y: 1.28, s: 2 },
    { id: "pie-t2b", x: X.s2, y: 1.82, s: 2 },
    { id: "pie-t4a", x: X.s4, y: 1.28, s: 4 },
    { id: "pie-t4b", x: X.s4, y: 1.82, s: 4 },
  ].map((t) => pz({ id: t.id, kind: "shelf", label: "Tablilla de piedra", section: t.s, x: t.x + 0.02, y: t.y, w: 0.86, h: 0.04, d: 0.3, visible: true, material: "stone" })),
  pz({ id: "pie-s2", kind: "countertop", label: "Sobre de piedra izquierdo", section: 2, x: X.s2, y: 0.72, w: 0.9, h: 0.07, d: 0.43, material: "stone" }),
  pz({ id: "pie-s3", kind: "countertop", label: "Sobre de piedra central", section: 3, x: X.s3, y: 0.72, w: 2.57, h: 0.07, d: 0.43, material: "stone" }),
  pz({ id: "pie-s4", kind: "countertop", label: "Sobre de piedra derecho", section: 4, x: X.s4, y: 0.72, w: 0.9, h: 0.07, d: 0.43, material: "stone" }),
  pz({ id: "pie-tir", kind: "reference", label: "6 tiradores de piedra", section: 3, x: X.s2, y: 0.5, w: 0.04, h: 0.15, d: 0.02, material: "stone", notes: "Tirador de piedra ondulado (detalle de la hoja 4)." }),

  // Referencias (no se cotizan)
  pz({ id: "ref-tv", kind: "reference", ref: "tv", label: "TV", section: 3, x: 2.47, y: 1.43, w: 1.37, h: 0.78, d: 0.05 }),
  pz({ id: "ref-sonido", kind: "reference", ref: "sound", label: "Barra de sonido", section: 3, x: 2.6, y: 1.12, w: 1.1, h: 0.07, d: 0.09 }),
  pz({ id: "ref-ac", kind: "reference", ref: "ac", label: "Aire acondicionado", section: 3, x: 2.6, y: 2.48, w: 0.9, h: 0.3, d: 0.22 }),
];

export const THE_WOODS: PlanReading = {
  title: "Mueble Family — The Woods 10-32",
  finishFromPlan: "pintado",
  pieces,
  doubts: [
    "La rejilla del A/C: ¿abre hacia arriba? El plano no lo dice.",
    "Arriba a la derecha el plano marca 0.49 y 0.53; se usó 0.57 (la más grande del mueble).",
    "Tablillas internas: una por cada hoja de puerta (6 tramos).",
  ],
};
