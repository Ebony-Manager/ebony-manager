import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import {
  EMPLOYEE_FORM_ID,
  answersFromApi,
  answersFromRawRequest,
  normalizeIntake,
  type AnswersByName,
} from "@/lib/personal/jotform-intake";

/**
 * Webhook de JotForm: cada vez que alguien envía el formulario "Registro
 * Empleado", JotForm hace POST acá (`?token=...` en la URL) y la respuesta
 * cae en la bandeja de Staff ("Nuevos registros").
 *
 * Sin sesión y sin service_role: escribe con la clave pública llamando a
 * `public.ingest_staff_intake`, que en Postgres compara el token con el hash
 * guardado y es la única puerta de entrada a `staff_intake`. Con
 * `JOTFORM_API_KEY` configurada, los datos se piden a la API de JotForm (la
 * fuente confiable) en vez de leerlos del cuerpo del POST.
 */

export const dynamic = "force-dynamic";

const JOTFORM_API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";

/** Respuestas de un envío, desde la API de JotForm. null si no hay API key o falla. */
async function answersFromJotformApi(submissionId: string): Promise<AnswersByName | null> {
  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${JOTFORM_API}/submission/${encodeURIComponent(submissionId)}`, {
      headers: { APIKEY: apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: { form_id?: string; answers?: Record<string, { name?: string; answer?: unknown }> } };
    if (body.content?.form_id !== EMPLOYEE_FORM_ID || !body.content.answers) return null;
    return answersFromApi(body.content.answers);
  } catch (err) {
    console.error("JotForm webhook: no se pudo leer el envío por la API", err);
    return null;
  }
}

async function readBody(request: NextRequest): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 401 });

  let body: Record<string, string>;
  try {
    body = await readBody(request);
  } catch {
    return Response.json({ ok: false, error: "bad body" }, { status: 400 });
  }

  const formId = body.formID ?? "";
  const submissionId = body.submissionID ?? "";
  // Otro formulario apuntando a este webhook: se ignora sin error, para que
  // JotForm no lo reintente.
  if (formId !== EMPLOYEE_FORM_ID) return Response.json({ ok: true, ignored: true });
  if (!/^\d+$/.test(submissionId)) return Response.json({ ok: false, error: "bad submissionID" }, { status: 400 });

  let answers = await answersFromJotformApi(submissionId);
  if (!answers) {
    try {
      answers = answersFromRawRequest(JSON.parse(body.rawRequest ?? "{}") as Record<string, unknown>);
    } catch {
      return Response.json({ ok: false, error: "bad rawRequest" }, { status: 400 });
    }
  }

  const f = normalizeIntake(answers);
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.rpc("ingest_staff_intake", {
    p_token: token,
    p_data: {
      form_id: formId,
      submission_id: submissionId,
      submitted_at: new Date().toISOString(),
      first_name: f.firstName,
      last_name: f.lastName,
      email: f.email,
      phone: f.phone,
      birth_date: f.birthDate,
      address: f.address,
      id_document_url: f.idDocumentUrl,
      bank_name: f.bankName,
      bank_account_type: f.bankAccountType,
      bank_account_number: f.bankAccountNumber,
      emergency_contact_name: f.emergencyContactName,
      emergency_contact_phone: f.emergencyContactPhone,
      emergency_contact_relation: f.emergencyContactRelation,
      raw: answers as Json,
    },
  });
  if (error) {
    const unauthorized = error.code === "42501" || error.message.includes("TOKEN_INVALIDO");
    if (!unauthorized) console.error("JotForm webhook: no se pudo guardar", error);
    return Response.json({ ok: false, error: unauthorized ? "invalid token" : "save failed" }, { status: unauthorized ? 401 : 500 });
  }
  return Response.json({ ok: true });
}
