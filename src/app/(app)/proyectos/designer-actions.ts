"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { addProjectDesigner, removeProjectDesigner } from "@/services/project-designers";
import { projectPath } from "./paths";

type Result = { ok: true } | { ok: false; error: string };

// Asignar o quitar diseñadoras de un proyecto: lo hace quien administra proyectos (la RLS lo repite).

export async function addProjectDesignerAction(projectId: string, employeeId: string): Promise<Result> {
  await requireAnyModule("proyectos", "contratistas");
  try {
    await addProjectDesigner(projectId, employeeId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidatePath(projectPath(projectId));
  return { ok: true };
}

export async function removeProjectDesignerAction(projectId: string, employeeId: string): Promise<Result> {
  await requireAnyModule("proyectos", "contratistas");
  try {
    await removeProjectDesigner(projectId, employeeId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidatePath(projectPath(projectId));
  return { ok: true };
}
