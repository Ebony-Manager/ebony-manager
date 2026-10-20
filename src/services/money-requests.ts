import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { MoneyRequest } from "@/types/money-requests";

/**
 * Bandeja "Solicitudes de dinero" (Planilla → Préstamos): lo que llega del
 * workflow de JotForm ya aprobado. Se lee y se resuelve con la sesión del
 * usuario (la RLS pide Planilla o Contratistas); nunca se inserta desde acá —
 * eso lo hace solo `ingest_money_request`.
 */

type Row = Database["public"]["Tables"]["money_requests"]["Row"];

function mapRequest(r: Row): MoneyRequest {
  return {
    id: r.id,
    submissionId: r.submission_id,
    receivedAt: r.submitted_at ?? r.created_at,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    type: r.request_type === "adelanto" || r.request_type === "prestamo" ? r.request_type : null,
    amountCents: r.amount_cents,
    deductCents: r.deduct_cents,
  };
}

/** Pendientes de registrar, la más vieja primero (se atienden en orden). */
export async function getPendingMoneyRequests(): Promise<MoneyRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("money_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRequest);
}

export async function getMoneyRequest(id: string): Promise<MoneyRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("money_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRequest(data) : null;
}

export async function resolveMoneyRequest(
  id: string,
  resolution: { status: "registered"; kind: "employee" | "contractor"; personId: string } | { status: "dismissed" },
  userId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("money_requests")
    .update({
      status: resolution.status,
      person_kind: resolution.status === "dismissed" ? null : resolution.kind,
      person_id: resolution.status === "dismissed" ? null : resolution.personId,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Cuántas solicitudes y registros esperan revisión (para los indicadores rojos del menú). */
export async function getPendingCounts(): Promise<{ moneyRequests: number; intakes: number }> {
  const supabase = await createClient();
  const [money, intake] = await Promise.all([
    supabase.from("money_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("staff_intake").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return { moneyRequests: money.count ?? 0, intakes: intake.count ?? 0 };
}
