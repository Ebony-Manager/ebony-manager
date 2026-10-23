import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { PlanPiece, PlanReading } from "@/types/plan";

/**
 * Lectura de un plano con Claude. Recibe el archivo (PDF o imagen) y
 * devuelve el mueble descompuesto en piezas (`PlanReading`) con las
 * reglas de medición de Ebony. Las reglas de PRECIO no van acá: Claude
 * solo mide y ubica; los renglones salen de `plan-rules.ts`, que es
 * determinístico y está probado contra The Woods.
 *
 * La llave va en la variable de entorno ANTHROPIC_API_KEY (Vercel y
 * .env.local); nunca en el código.
 */

export const PLAN_MODEL = "claude-opus-5-5";

export function hasPlanReaderKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const INSTRUCTIONS = `Eres el medidor de Ebony Custom Woodwork, una ebanistería en Panamá. Recibes el plano de un mueble a la medida (elevaciones, secciones, planta, isométrico) y lo descompones en piezas para cotizar.

Cómo mide Ebony:
- Secciona el mueble en secciones verticales (1, 2, 3… de izquierda a derecha) y cada sección en zonas (superior, nicho, bajo).
- "module" = el caparazón interno de cada zona que tiene puertas o gavetas. Una pieza por zona continua, con el ANCHO GENERAL de la zona (incluye las columnas que quedan dentro) × su alto. Los nichos abiertos NO son módulo.
- "door" = las hojas de puerta de una zona: w = ancho general de la zona, h = alto, y leaves = el ancho de cada hoja tal como lo acota el plano. Puertas con listones o rejilla: slats = ancho del listón en metros. opening: "arriba" si la puerta abre hacia arriba (rejillas, abatibles superiores), "abatible" si abre de lado; si el plano no lo dice, pon "abatible" y anótalo en doubts.
- "drawer" = frente de cada gaveta (ancho × alto del frente).
- "shelf" = tablillas. visible=false si están detrás de puertas (internas; las secciones del plano suelen mostrarlas aunque la elevación no) y segments = cuántos tramos (normalmente uno por hoja de puerta). visible=true si están a la vista. d = fondo de la tablilla.
- "column" = columnas o piezas verticales completas a la vista: w = su ancho de frente, h = alto, d = fondo.
- "panel" = panelado o revestimiento visible: laterales de piso a techo, fondo detrás de la TV, fondo de los nichos, paneles bajo gavetas. Ancho × alto completo, sin descontar dilataciones.
- "countertop" = sobres o topes.
- "reference" = lo que se dibuja pero no se fabrica: TV (ref "tv"), aire acondicionado ("ac"), barra de sonido ("sound").
- material "stone" para todo lo de piedra, mármol, granito o terrazo (sobres, tablillas, tiradores): Ebony nunca lo cotiza, pero va en la lista para dibujarlo. "glass" para vidrio, "metal" para metal.
- Cuando dos vistas del plano dan medidas distintas para lo mismo (0.57 en una, 0.53 en otra), usa SIEMPRE la más grande, y anótalo en notes.

Coordenadas en metros, vistas de frente: x desde el borde izquierdo del conjunto, y desde el piso, w ancho, h alto, d fondo. Usa las cotas escritas; si una medida no está acotada, dedúcela de la escala o de las cotas vecinas y baja confidence a "media" o "baja".

confidence: "alta" si la medida está escrita en el plano, "media" si la deduces de otras cotas, "baja" si la estimas.

finishFromPlan: "pintado" si el plano dice laqueado, pintado o poliuretano; "chapilla" si dice chapilla o enchapado; "aglomerado" si dice melamina; null si no lo dice.

doubts: lista corta, en español, de lo que el plano no aclara y hay que preguntar (hacia dónde abre una puerta, medidas que no coinciden, materiales sin especificar, piezas que no estás seguro si son puerta o panel).

Devuelve TODAS las piezas del mueble, también las de piedra y las referencias.`;

const num = { type: "number" } as const;
const PIECE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "kind", "label", "section", "x", "y", "w", "h", "d", "confidence", "leaves", "slats", "visible", "segments", "material", "opening", "ref", "notes"],
  properties: {
    id: { type: "string", description: "Identificador corto y único, p. ej. 'pta-sup-2'." },
    kind: { type: "string", enum: ["panel", "module", "door", "drawer", "shelf", "column", "countertop", "reference"] },
    label: { type: "string", description: "Nombre corto en español: 'Puertas superiores izquierda'." },
    section: { type: "integer" },
    x: num,
    y: num,
    w: num,
    h: num,
    d: num,
    confidence: { type: "string", enum: ["alta", "media", "baja"] },
    leaves: { anyOf: [{ type: "array", items: num }, { type: "null" }] },
    slats: { anyOf: [num, { type: "null" }] },
    visible: { anyOf: [{ type: "boolean" }, { type: "null" }] },
    segments: { anyOf: [{ type: "integer" }, { type: "null" }] },
    material: { anyOf: [{ type: "string", enum: ["stone", "glass", "metal"] }, { type: "null" }] },
    opening: { anyOf: [{ type: "string", enum: ["abatible", "arriba", "gola", "push", "tirador"] }, { type: "null" }] },
    ref: { anyOf: [{ type: "string", enum: ["tv", "ac", "sound"] }, { type: "null" }] },
    notes: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
};
const READING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "finishFromPlan", "pieces", "doubts"],
  properties: {
    title: { type: "string", description: "Nombre del mueble y del proyecto, p. ej. 'Mueble Family — The Woods 10-32'." },
    finishFromPlan: { anyOf: [{ type: "string", enum: ["pintado", "chapilla", "aglomerado"] }, { type: "null" }] },
    pieces: { type: "array", items: PIECE_SCHEMA },
    doubts: { type: "array", items: { type: "string" } },
  },
};

type RawPiece = Omit<PlanPiece, "leaves" | "slats" | "visible" | "segments" | "material" | "opening" | "ref" | "notes"> & {
  leaves: number[] | null;
  slats: number | null;
  visible: boolean | null;
  segments: number | null;
  material: PlanPiece["material"] | null;
  opening: PlanPiece["opening"] | null;
  ref: PlanPiece["ref"] | null;
  notes: string | null;
};

/** Quita los null del esquema estricto y descarta lo que no tenga medidas válidas. */
function clean(raw: { title: string; finishFromPlan: PlanReading["finishFromPlan"]; pieces: RawPiece[]; doubts: string[] }): PlanReading {
  const seen = new Set<string>();
  const pieces: PlanPiece[] = [];
  for (const p of raw.pieces) {
    if (![p.x, p.y, p.w, p.h, p.d].every((v) => Number.isFinite(v)) || p.w <= 0 || p.h <= 0) continue;
    let id = p.id || `p${pieces.length + 1}`;
    while (seen.has(id)) id = `${id}-b`;
    seen.add(id);
    const piece: PlanPiece = { id, kind: p.kind, label: p.label, section: p.section, x: p.x, y: p.y, w: p.w, h: p.h, d: p.d, confidence: p.confidence };
    if (p.leaves?.length) piece.leaves = p.leaves;
    if (p.slats) piece.slats = p.slats;
    if (p.visible !== null) piece.visible = p.visible;
    if (p.segments) piece.segments = p.segments;
    if (p.material) piece.material = p.material;
    if (p.opening) piece.opening = p.opening;
    if (p.ref) piece.ref = p.ref;
    if (p.notes) piece.notes = p.notes;
    pieces.push(piece);
  }
  return { title: raw.title, finishFromPlan: raw.finishFromPlan, pieces, doubts: raw.doubts };
}

export class PlanReadError extends Error {}

export async function readPlan(file: { data: Buffer; mediaType: string; name: string }): Promise<PlanReading> {
  if (!hasPlanReaderKey()) throw new PlanReadError("Falta configurar la llave de la API de Claude (ANTHROPIC_API_KEY).");

  const client = new Anthropic();
  const base64 = file.data.toString("base64");
  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: file.mediaType as "image/png" | "image/jpeg" | "image/webp", data: base64 } };

  try {
    const stream = client.beta.messages.stream({
      model: PLAN_MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: READING_SCHEMA } },
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: `Plano: ${file.name}. Descompón el mueble en piezas.` }] }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") throw new PlanReadError("Claude no pudo leer este plano. Prueba con otro archivo o cotiza a mano.");
    if (message.stop_reason === "max_tokens") throw new PlanReadError("El plano es demasiado grande para leerlo de una vez. Prueba subiendo solo las hojas del mueble.");
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return clean(JSON.parse(text));
  } catch (err) {
    if (err instanceof PlanReadError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new PlanReadError("La llave de la API de Claude no es válida.");
    if (err instanceof Anthropic.RateLimitError) throw new PlanReadError("Claude está ocupado. Espera un minuto y vuelve a intentar.");
    if (err instanceof Anthropic.BadRequestError) throw new PlanReadError(`Claude rechazó el archivo: ${err.message}`);
    if (err instanceof SyntaxError) throw new PlanReadError("La lectura del plano llegó incompleta. Vuelve a intentar.");
    throw err;
  }
}
