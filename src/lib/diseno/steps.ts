import type { ItemFile, ItemFileKind, ItemStage } from "@/types/diseno";

/** Los pasos que piden un documento: se sube en la ficha del ítem y el botón del paso se habilita con él. */
export type FileStep = "medido" | "enviar" | "aprobado";

export const STEP_FILE: Record<FileStep, ItemFileKind> = { medido: "medidas", enviar: "presentacion", aprobado: "aprobada" };
export const STEP_FROM: Record<FileStep, ItemStage> = { medido: "por_medir", enviar: "en_diseno", aprobado: "con_cliente" };
export const STEP_TO: Record<FileStep, ItemStage> = { medido: "en_diseno", enviar: "con_cliente", aprobado: "aprobado" };

/** El paso de cada etapa (el que pide documento). */
export const STAGE_STEP: Partial<Record<ItemStage, FileStep>> = { por_medir: "medido", en_diseno: "enviar", con_cliente: "aprobado" };

/** La ronda con la que se anota un documento: la presentación es la de la ronda que se va a enviar. */
export function fileRound(item: { round: number }, kind: ItemFileKind): number {
  return kind === "presentacion" ? item.round + 1 : item.round;
}

/** Los documentos que cuentan para el paso: la hoja de medidas (cualquiera), la presentación de la ronda que se
 *  va a enviar y la aprobada de la ronda que está con el cliente. */
export function stepFiles<F extends Pick<ItemFile, "kind" | "round">>(item: { round: number; files: F[] }, step: FileStep): F[] {
  const kind = STEP_FILE[step];
  return item.files.filter((f) => f.kind === kind && (kind === "medidas" || f.round === fileRound(item, kind)));
}

export const hasStepFile = (item: { round: number; files: Pick<ItemFile, "kind" | "round">[] }, step: FileStep) => stepFiles(item, step).length > 0;
