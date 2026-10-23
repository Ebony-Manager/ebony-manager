export const PROJECTS_PATH = "/proyectos";

/** La ficha de un proyecto (con la pestaña a abrir, si se pide una). */
export function projectPath(id: string, tab?: string): string {
  return tab ? `${PROJECTS_PATH}/${id}?tab=${tab}` : `${PROJECTS_PATH}/${id}`;
}
