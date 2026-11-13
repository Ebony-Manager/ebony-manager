import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { suggestedProjectName, whoOf } from "@/lib/ventas/opportunities";
import { driveEnabled, getItem, renameItem } from "./drive";

/**
 * Las carpetas de Drive se llaman igual que en la aplicación: un proyecto, por su nombre; una oportunidad
 * (que aún no es proyecto), por su nombre de proyecto. Renombrar no cambia el identificador de la carpeta,
 * así que los enlaces y lo que hay dentro siguen igual.
 */
export interface DriveNamesResult {
  renamed: { from: string; to: string }[];
  unchanged: number;
  errors: string[];
}

type Db = SupabaseClient<Database>;

/** Un nombre de carpeta para una oportunidad: su nombre de proyecto o, si falta, lo que se arma con quién y dónde. */
export function opportunityFolderName(
  o: { title: string; building: string | null; unit: string | null; designer_id: string | null; client_id: string | null },
  nameOf: (id: string) => string | undefined,
): string {
  return o.title.trim() || suggestedProjectName(whoOf(o.designer_id, o.client_id, nameOf), o.building, o.unit) || "Oportunidad";
}

async function applyNames(targets: Map<string, string>): Promise<DriveNamesResult> {
  const out: DriveNamesResult = { renamed: [], unchanged: 0, errors: [] };
  let attempts = 0;
  for (const [id, to] of targets) {
    try {
      const current = await getItem(id);
      if (current.name === to) {
        out.unchanged++;
        continue;
      }
      attempts++;
      await renameItem(id, to);
      out.renamed.push({ from: current.name, to });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      out.errors.push(`${to}: ${message}`);
      // Si el primer intento falla por permisos, no tiene caso seguir con las demás.
      if (attempts === 1 && out.renamed.length === 0 && /permission|forbidden|403|insufficient/i.test(message)) break;
    }
  }
  return out;
}

/** Todas las carpetas (proyectos y oportunidades) al nombre que tienen en la aplicación. */
export async function syncAllDriveNames(supabase: Db): Promise<DriveNamesResult> {
  if (!driveEnabled()) throw new Error("Drive no está conectado");
  const [{ data: projects, error: pe }, { data: opps, error: oe }, { data: people }] = await Promise.all([
    supabase.from("projects").select("name, drive_folder_id").not("drive_folder_id", "is", null),
    supabase.from("sales_opportunities").select("title, building, unit, designer_id, client_id, drive_folder_id, project_id").not("drive_folder_id", "is", null),
    supabase.from("clients").select("id, name"),
  ]);
  if (pe) throw new Error(pe.message);
  if (oe) throw new Error(oe.message);
  const nameOf = (id: string) => (people ?? []).find((p) => p.id === id)?.name;
  const targets = new Map<string, string>();
  // Primero las oportunidades; si su carpeta ya es la de un proyecto, manda el nombre del proyecto.
  for (const o of opps ?? []) if (o.drive_folder_id) targets.set(o.drive_folder_id, opportunityFolderName(o, nameOf));
  for (const p of projects ?? []) if (p.drive_folder_id) targets.set(p.drive_folder_id, p.name);
  return applyNames(targets);
}

/** Después de editar un proyecto: su carpeta toma el nombre nuevo. Nunca lanza error. */
export async function syncProjectFolderName(supabase: Db, projectId: string): Promise<void> {
  if (!driveEnabled()) return;
  try {
    const { data: p } = await supabase.from("projects").select("name, drive_folder_id").eq("id", projectId).maybeSingle();
    if (p?.drive_folder_id) await applyNames(new Map([[p.drive_folder_id, p.name]]));
  } catch (err) {
    console.error("Drive: renombrar carpeta del proyecto", err);
  }
}

/** Después de editar una oportunidad: su carpeta toma el nombre nuevo (si ya es proyecto, manda el del proyecto). Nunca lanza error. */
export async function syncOpportunityFolderName(supabase: Db, opportunityId: string): Promise<void> {
  if (!driveEnabled()) return;
  try {
    const { data: o } = await supabase
      .from("sales_opportunities")
      .select("title, building, unit, designer_id, client_id, drive_folder_id, project_id")
      .eq("id", opportunityId)
      .maybeSingle();
    if (!o?.drive_folder_id) return;
    if (o.project_id) {
      const { data: p } = await supabase.from("projects").select("name").eq("id", o.project_id).maybeSingle();
      if (p) return void (await applyNames(new Map([[o.drive_folder_id, p.name]])));
    }
    const ids = [o.designer_id, o.client_id].filter((v): v is string => !!v);
    const { data: people } = ids.length ? await supabase.from("clients").select("id, name").in("id", ids) : { data: [] };
    const nameOf = (id: string) => (people ?? []).find((p) => p.id === id)?.name;
    await applyNames(new Map([[o.drive_folder_id, opportunityFolderName(o, nameOf)]]));
  } catch (err) {
    console.error("Drive: renombrar carpeta de la oportunidad", err);
  }
}
