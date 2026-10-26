export const INSPECTIONS_PATH = "/inspecciones";

/** Las inspecciones de un proyecto. */
export function inspectionsPath(projectId: string): string {
  return `${INSPECTIONS_PATH}/${projectId}`;
}

/** Las inspecciones de un proyecto, empezando una nueva (la visita de hoy, o una nueva). */
export function newInspectionPath(projectId: string): string {
  return `${inspectionsPath(projectId)}?nueva=1`;
}
