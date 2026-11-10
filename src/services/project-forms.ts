import "server-only";

import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { syncProjectOptions } from "@/lib/deliveries/acta-server";

/**
 * Después de crear, renombrar, terminar o borrar un proyecto: la lista de
 * proyectos de los formularios de JotForm (acta, pintura, embalaje) se pone
 * al día con los activos. Los nombres se leen ahora (con la sesión) y JotForm
 * se actualiza después de responder, sin demorar a quien guardó.
 */
export async function syncProjectFormsAfter(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("projects").select("name").eq("status", "ACTIVE");
    if (error) throw new Error(error.message);
    const names = (data ?? []).map((p) => p.name);
    after(async () => {
      await syncProjectOptions(names).catch((err) => console.error("JotForm: lista de proyectos", err));
    });
  } catch (err) {
    console.error("JotForm: no se pudo leer la lista de proyectos", err);
  }
}
