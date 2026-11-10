"use server";

import { getProfile } from "@/lib/auth/dal";
import { hasAnyModule, hasExplicitModule } from "@/lib/auth/modules";
import { createClient } from "@/lib/supabase/server";
import { DELIVERY_FORMS, actaPrefillUrl, formUrl, type DeliveryKind } from "@/lib/deliveries/acta-form";
import { getFormQuestions } from "@/lib/deliveries/acta-server";

// Accesos rápidos de autorizaciones (pintura / embalaje): antes de abrir el
// formulario se escoge el proyecto, y el formulario abre con su nombre puesto
// (así el envío cae solo en ese proyecto). Lo usa quien tiene el acceso
// rápido, aunque no tenga el módulo de Proyectos.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function canUse(): Promise<boolean> {
  const profile = await getProfile();
  return !!profile && (hasExplicitModule(profile, "form_autorizaciones") || hasAnyModule(profile, ["proyectos", "contratistas"]));
}

async function activeProjects(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("active_projects_for_forms");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}

/** Los proyectos activos (id y nombre) para escoger. */
export async function getFormProjectsAction(): Promise<Result<{ id: string; name: string }[]>> {
  if (!(await canUse())) return { ok: false, error: "Sin permiso" };
  try {
    return { ok: true, data: await activeProjects() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/** El enlace del formulario con el proyecto escogido ya puesto. */
export async function getProjectFormUrlAction(kind: DeliveryKind, projectId: string): Promise<Result<string>> {
  if (!(await canUse())) return { ok: false, error: "Sin permiso" };
  try {
    const project = (await activeProjects()).find((p) => p.id === projectId);
    if (!project) return { ok: false, error: "Proyecto no encontrado" };
    const questions = await getFormQuestions(DELIVERY_FORMS[kind].formId).catch(() => []);
    return { ok: true, data: questions.length ? actaPrefillUrl(questions, { project: project.name }, formUrl(kind)) : formUrl(kind) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
