"use server";

import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** Autorizar o rechazar la herramienta de IA; Supabase devuelve a dónde volver. */
export async function decideAuthorization(form: FormData) {
  await requireProfile();
  const id = String(form.get("authorization_id") ?? "");
  const approve = form.get("decision") === "approve";
  const supabase = await createClient();
  const { data, error } = approve ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id);
  if (error || !data?.redirect_url) throw new Error(error?.message ?? "No se pudo completar la autorización.");
  redirect(data.redirect_url);
}
