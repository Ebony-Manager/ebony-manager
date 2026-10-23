import type { Finish } from "@/types/cotizador";

/**
 * Lectura de un plano: el mueble descompuesto en PIEZAS con su medida y
 * su lugar en la elevación. Es lo que devuelve la lectura con IA (o la
 * lectura de ejemplo), lo que el usuario revisa, y de donde salen tanto
 * los renglones de la cotización (`plan-rules.ts`) como el dibujo 3D.
 *
 * Coordenadas en metros, vistas de frente (elevación):
 *   x = desde el borde izquierdo del conjunto, y = desde el piso,
 *   w = ancho, h = alto, d = fondo (profundidad).
 *
 * Las medidas siguen la regla de la cotizadora: cuando dos vistas del
 * plano no coinciden (0.57 en una, 0.53 en otra), se usa la más grande.
 */

export type PieceKind =
  /** Panelado / revestimiento visible (laterales, fondo de TV, fondo de nichos). */
  | "panel"
  /** Caparazón interno de una zona con puertas o gavetas (el "módulo"). */
  | "module"
  /** Hojas de puerta de una zona. `leaves` = ancho de cada hoja. */
  | "door"
  /** Frente de gaveta (la estructura interna se deduce). */
  | "drawer"
  /** Tablilla: interna (detrás de puertas) o vista. */
  | "shelf"
  /** Pieza vertical completa (columna, divisor visto). */
  | "column"
  /** Sobre / tope. */
  | "countertop"
  /** Elemento que se dibuja como referencia y nunca se cotiza (TV, A/C, barra de sonido). */
  | "reference";

/** Material distinto del mueble. La piedra nunca la cotiza Ebony. */
export type PieceMaterial = "stone" | "glass" | "metal";

export type Opening = "abatible" | "arriba" | "gola" | "push" | "tirador";

export interface PlanPiece {
  id: string;
  kind: PieceKind;
  /** Nombre corto para la revisión: "Puertas superiores izquierda". */
  label: string;
  /** Sección vertical del mueble (1, 2, 3…) tal como se secciona el plano. */
  section: number;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  /** Puertas: ancho de cada hoja (cuenta bisagras y se dibujan). */
  leaves?: number[];
  /** Puertas con listones (rejilla) o panel con listones: ancho del listón en m. */
  slats?: number;
  /** Tablillas: si quedan a la vista. Las internas van en aglomerado. */
  visible?: boolean;
  /** Tablillas internas: en cuántos tramos va partida (cada tramo lleva 4 soportes). */
  segments?: number;
  material?: PieceMaterial;
  opening?: Opening;
  /** Para referencias: qué es (tv, ac, sonido). */
  ref?: "tv" | "ac" | "sound";
  /** Seguridad de la lectura: alta (cota escrita), media (deducida), baja (estimada). */
  confidence: "alta" | "media" | "baja";
  notes?: string;
}

/** Respuestas del cuestionario: lo que el plano no dice. */
export interface PlanAnswers {
  /** Acabado de lo que se ve. El interno es siempre aglomerado (melamina). */
  exteriorFinish: Exclude<Finish, "blanco">;
  hinge: "recta" | "cangrejo";
  slide: "economico" | "blum" | "lateral";
  /** Apertura de puertas y gavetas sin tirador. */
  opening: "gola" | "push" | "tirador";
  /** ¿Ebony suministra los tiradores? (los de piedra nunca). */
  pullsIncluded: boolean;
  /** Metros lineales de luz LED (0 = sin LED). */
  ledMl: number;
  /** Metros lineales de estructura metálica (p. ej. para tablillas de piedra). */
  metalMl: number;
}

export const DEFAULT_ANSWERS: PlanAnswers = {
  exteriorFinish: "pintado",
  hinge: "recta",
  slide: "economico",
  opening: "gola",
  pullsIncluded: false,
  ledMl: 0,
  metalMl: 0,
};

/** Resultado de leer un plano. */
export interface PlanReading {
  title: string;
  /** Acabado que dice el plano, si lo dice ("MDF laqueado" → pintado). */
  finishFromPlan: PlanAnswers["exteriorFinish"] | null;
  pieces: PlanPiece[];
  /** Lo que el plano no aclara y hay que preguntar o confirmar. */
  doubts: string[];
}
