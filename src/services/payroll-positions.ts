import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { PayrollPosition } from "@/types/planilla";

/**
 * Catálogo editable de posiciones/funciones de planilla (`payroll_positions`,
 * RLS solo-admin — mismo patrón que `payroll-employees.ts`). Alimenta el
 * dropdown de "Posición" en el formulario de empleado, con "Otro" como
 * escape a texto libre; `payroll_employees.position` sigue siendo texto
 * libre y nunca se valida contra este catálogo.
 *
 * Desactivar (`active: false`) es el único "borrado" — nunca delete real,
 * para que ningún empleado histórico con esa posición quede roto ni el
 * dropdown pierda silenciosamente una opción que ya está en uso.
 */

type Row = Database["public"]["Tables"]["payroll_positions"]["Row"];

function mapPosition(r: Row): PayrollPosition {
  return { id: r.id, name: r.name, active: r.active, sortOrder: r.sort_order };
}

/** Activas primero, por `sort_order`, luego por nombre — igual criterio que empleados. */
export async function getPayrollPositions(): Promise<PayrollPosition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_positions")
    .select("*")
    .order("active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPosition);
}

export async function createPayrollPosition(name: string): Promise<PayrollPosition> {
  const supabase = await createClient();
  const { data: maxRow, error: maxErr } = await supabase
    .from("payroll_positions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw new Error(maxErr.message);
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("payroll_positions")
    .insert({ name: name.trim(), sort_order: nextSort })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPosition(data);
}

/** Patch parcial — renombrar y/o activar/desactivar. El trigger
 *  `payroll_positions_touch_updated_at` mantiene `updated_at`. */
export async function updatePayrollPosition(id: string, input: { name?: string; active?: boolean }): Promise<void> {
  const patch: Database["public"]["Tables"]["payroll_positions"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_positions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
