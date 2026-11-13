import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DesignerCandidate, DesignerQuote, DesignerQuoteLine, DesignerQuoteSection, DesignerQuoteSummary, ProjectDesigner } from "@/types/designers";

/**
 * Diseñadoras en los proyectos. Las lecturas pasan por funciones de la base (security definer) para no abrir
 * Personal (sueldos) ni las cotizaciones (precios): ver supabase/migrations/20261113200000_disenadoras_proyectos.sql.
 */

export async function getProjectDesigners(projectId: string): Promise<ProjectDesigner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_designers_list", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ employeeId: r.employee_id, name: r.name, position: r.position, active: r.active, hasAccess: r.has_access }));
}

export async function getDesignerCandidates(): Promise<DesignerCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("designer_candidates");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, position: r.position, hasAccess: r.has_access }));
}

export async function addProjectDesigner(projectId: string, employeeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_designers").upsert({ project_id: projectId, employee_id: employeeId }, { onConflict: "project_id,employee_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeProjectDesigner(projectId: string, employeeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_designers").delete().eq("project_id", projectId).eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
}

export async function getDesignerProjectQuotes(projectId: string): Promise<DesignerQuoteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("designer_project_quotes", { p_project: projectId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    quoteDate: r.quote_date,
    clientName: r.client_name,
    designerName: r.designer_name,
    projectName: r.project_name,
    items: r.items,
  }));
}

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** La cotización sin precios, o null si no existe o no es de un proyecto de la diseñadora. */
export async function getDesignerQuote(quoteId: string): Promise<DesignerQuote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("designer_quote", { p_quote: quoteId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const q = data as Raw;
  const sections = ((q.sections as Raw[] | null) ?? []).map(
    (s): DesignerQuoteSection => ({
      id: String(s.id),
      sortOrder: Number(s.sort_order ?? 0),
      location: str(s.location),
      name: str(s.name),
      kind: str(s.kind),
      description: str(s.description),
      qty: Number(s.qty ?? 1),
      lines: ((s.lines as Raw[] | null) ?? []).map(
        (l): DesignerQuoteLine => ({
          id: String(l.id),
          name: String(l.name ?? ""),
          category: str(l.category),
          finish: str(l.finish),
          unit: str(l.unit),
          shape: str(l.shape),
          mode: str(l.mode),
          width: num(l.width),
          height: num(l.height),
          pieces: num(l.pieces),
          qty: num(l.qty),
          wall: str(l.wall),
        }),
      ),
      images: ((s.images as unknown[] | null) ?? []).filter((p): p is string => typeof p === "string"),
    }),
  );
  return {
    id: String(q.id),
    number: String(q.number ?? ""),
    status: String(q.status ?? ""),
    quoteDate: str(q.quote_date),
    deliveryDays: num(q.delivery_days),
    lang: str(q.lang),
    clientName: String(q.client_name ?? ""),
    designerName: String(q.designer_name ?? ""),
    projectName: String(q.project_name ?? ""),
    projectId: str(q.project_id),
    sections,
  };
}


/** Los proyectos que lleva quien tiene sesión (la RLS deja ver solo sus propias filas). */
export async function getMyDesignerProjectIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_designers").select("project_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.project_id);
}

/** Nombres de las diseñadoras de cada proyecto (para la lista de proyectos). */
export async function getProjectDesignerNames(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_designer_names");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.project_id, r.names]));
}
