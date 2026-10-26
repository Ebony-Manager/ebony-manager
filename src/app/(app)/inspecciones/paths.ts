export const INSPECTIONS_PATH = "/inspecciones";

/** Las inspecciones de un proyecto. */
export function inspectionsPath(projectId: string): string {
  return `${INSPECTIONS_PATH}/${projectId}`;
}
