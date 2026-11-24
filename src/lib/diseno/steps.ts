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
