/** Las tres carpetas de la Unidad compartida (ver drive-stages.ts). */
export type DriveStage = "OPORTUNIDADES" | "ACTIVOS" | "TERMINADOS";

/** Un proyecto terminado va a TERMINADOS; cualquier otro, a ACTIVOS. */
export function stageForProject(status: string | null | undefined): DriveStage {
  return status === "COMPLETED" ? "TERMINADOS" : "ACTIVOS";
}

/**
 * De qué carpetas sacarla para llevarla a `target`, o null si no se mueve:
 * ya está ahí, o está en una carpeta que la app no maneja (alguien la puso
 * ahí a propósito).
 */
export function shouldMove(parents: string[], target: string, managed: string[]): string[] | null {
  if (parents.includes(target)) return null;
  if (!parents.length || !parents.every((p) => managed.includes(p))) return null;
  return parents;
}
