import type { ItemFile, ItemFileKind, ItemStage } from "@/types/diseno";

/** Los pasos que piden un documento: se sube en la ficha del ítem y el botón del paso se habilita con él.
 *  (Sin etapa «Con el cliente»: el ida y vuelta va por WhatsApp; solo cuenta la presentación aprobada.) */
export type FileStep = "medido" | "aprobado";

export const STEP_FILE: Record<FileStep, ItemFileKind> = { medido: "medidas", aprobado: "aprobada" };
export const STEP_FROM: Record<FileStep, ItemStage> = { medido: "por_medir", aprobado: "en_diseno" };
export const STEP_TO: Record<FileStep, ItemStage> = { medido: "en_diseno", aprobado: "aprobado" };

/** El paso de cada etapa (el que pide documento). */
export const STAGE_STEP: Partial<Record<ItemStage, FileStep>> = { por_medir: "medido", en_diseno: "aprobado" };

/** La ronda con la que se anota un documento (se conserva por los archivos viejos con ronda). */
export function fileRound(item: { round: number }): number {
  return item.round;
}

/** Los documentos que cuentan para el paso: la hoja de medidas o la presentación aprobada. */
export function stepFiles<F extends Pick<ItemFile, "kind" | "round">>(item: { round: number; files: F[] }, step: FileStep): F[] {
  return item.files.filter((f) => f.kind === STEP_FILE[step]);
}

export const hasStepFile = (item: { round: number; files: Pick<ItemFile, "kind" | "round">[] }, step: FileStep) => stepFiles(item, step).length > 0;

/** Las etapas de una orden en las que lo del ítem ya no se toca (la orden está en revisión o más allá). */
export const LOCKED_ORDER_STATUSES = ["en_revision", "aprobada", "pedida", "en_taller"] as const;

/**
 * Qué se puede hacer con un archivo del ítem:
 *  - «fijo»: el ítem está en una orden en revisión o más allá: no se quita ni se cambia.
 *  - «cambiar»: es el documento que justificó un paso ya dado (la hoja de medidas fuera de Por medir, la aprobada en
 *    Aprobado): no se quita, solo se reemplaza por otra versión (para quitarlo, «Volver» a la etapa anterior).
 *  - «quitar»: se puede quitar.
 */
export function fileAction(item: { stage: ItemStage }, file: { kind: ItemFileKind }, orderStatus: string | null): "fijo" | "cambiar" | "quitar" {
  if (orderStatus && (LOCKED_ORDER_STATUSES as readonly string[]).includes(orderStatus)) return "fijo";
  if (file.kind === "medidas" && item.stage !== "por_medir") return "cambiar";
  if (file.kind === "aprobada" && (item.stage === "aprobado" || item.stage === "en_produccion")) return "cambiar";
  return "quitar";
}
