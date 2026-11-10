"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ACTA_FORM_URL, actaPrefillUrl } from "@/lib/deliveries/acta-form";
import { getActaQuestions } from "@/lib/deliveries/acta-server";
import { assignDelivery } from "@/services/deliveries";
import { projectPath } from "./paths";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * El enlace al formulario "Acta de Entrega" con el proyecto, la dirección y
 * (si el proyecto lo tiene) el cliente final ya puestos. Si JotForm no
 * responde, el formulario sin datos: se puede llenar igual.
 */
export async function getActaUrlAction(projectId: string): Promise<Result<{ url: string; prefilled: boolean }>> {
  await requireAnyModule("proyectos", "contratistas");
  const supabase = await createClient();
  const { data: project, error } = await supabase.from("projects").select("name, location, client_name, client_id").eq("id", projectId).single();
  if (error) return { ok: false, error: error.message };
  const { data: client } = project.client_id
    ? await supabase.from("clients").select("name, email").eq("id", project.client_id).maybeSingle()
    : { data: null };
  try {
    const questions = await getActaQuestions();
    if (!questions.length) return { ok: true, data: { url: ACTA_FORM_URL, prefilled: false } };
    const url = actaPrefillUrl(questions, {
      project: project.name,
      address: project.location,
      clientName: client?.name ?? null,
      email: client?.email ?? null,
    });
    return { ok: true, data: { url, prefilled: true } };
  } catch {
    return { ok: true, data: { url: ACTA_FORM_URL, prefilled: false } };
  }
}

/** Un acta que llegó sin proyecto → a este proyecto. */
export async function assignDeliveryAction(id: string, projectId: string): Promise<Result<null>> {
  await requireAnyModule("proyectos", "contratistas");
  try {
    await assignDelivery(id, projectId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
  revalidatePath(projectPath(projectId));
  return { ok: true, data: null };
}
