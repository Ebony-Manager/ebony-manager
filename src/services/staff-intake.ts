import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { StaffIntake } from "@/types/staff-intake";

/**
 * Bandeja "Nuevos registros" de Staff (`public.staff_intake`): lo que llega
 * del formulario de JotForm por el webhook. Se lee y se resuelve con la
 * sesión del usuario (la RLS pide Planilla o Contratistas); nunca se inserta
 * desde acá — eso lo hace solo `ingest_staff_intake`.
 */

type Row = Database["public"]["Tables"]["staff_intake"]["Row"];

function mapIntake(r: Row): StaffIntake {
  return {
    id: r.id,
    submissionId: r.submission_id,
    receivedAt: r.submitted_at ?? r.created_at,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    birthDate: r.birth_date,
    address: r.address,
    idDocumentUrl: r.id_document_url,
    idNumber: r.id_number,
    idDocumentType: r.id_document_type === "cedula" || r.id_document_type === "pasaporte" ? r.id_document_type : null,
    nationality: r.nationality,
    bankName: r.bank_name,
    bankAccountType: r.bank_account_type === "ahorro" || r.bank_account_type === "corriente" ? r.bank_account_type : null,
    bankAccountNumber: r.bank_account_number,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    emergencyContactRelation: r.emergency_contact_relation,
  };
}

/** Pendientes de revisar, el más nuevo primero. */
export async function getPendingIntake(): Promise<StaffIntake[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_intake")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIntake);
}

export async function getIntake(id: string): Promise<StaffIntake | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff_intake").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapIntake(data) : null;
}

/** Cierra un registro: se creó la ficha, se completó una existente o se descartó. */
export async function resolveIntake(
  id: string,
  resolution:
    | { status: "created" | "linked"; kind: "employee" | "contractor"; personId: string }
    | { status: "dismissed" },
  userId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_intake")
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
