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
import { MONEY_FORM_ID, answersFromWorkflowParams, normalizeMoneyRequest } from "@/lib/personal/jotform-money";

/**
 * Webhook de JotForm (una sola dirección, `?token=...`) para dos formularios:
 *
 * - "Registro Empleado" → bandeja "Nuevos registros" de Personal
 *   (`public.staff_intake`).
 * - "Solicitud Dinero" → bandeja "Solicitudes de dinero" de Planilla →
 *   Préstamos (`public.money_requests`). Este va en la rama APROBADA del
 *   workflow de JotForm: lo que llega ya está aprobado.
 *
 * Acepta POST (webhook del formulario: multipart con `rawRequest`) y GET o
 * POST con parámetros sueltos (paso "Webhook" del workflow, que manda solo
 * lo que se le configure: `formID`, `submissionID` y, sin API key, `nombre`,
 * `apellido`, `correo`, `tipo`, `monto`, `montoDescontar`).
 *
 * Sin sesión y sin service_role: escribe con la clave pública llamando a una
 * función de Postgres que compara el token con el hash guardado y es la única
 * puerta de entrada a cada tabla. Con `JOTFORM_API_KEY` configurada, los
 * datos se piden a la API de JotForm (la fuente confiable) en vez de leerlos
 * del cuerpo del POST.
 */

export const dynamic = "force-dynamic";

const JOTFORM_API = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";
const FORMS = new Set([EMPLOYEE_FORM_ID, MONEY_FORM_ID]);

/** Respuestas de un envío, desde la API de JotForm. null si no hay API key o falla. */
async function answersFromJotformApi(submissionId: string, formId: string): Promise<AnswersByName | null> {
  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${JOTFORM_API}/submission/${encodeURIComponent(submissionId)}`, {
      headers: { APIKEY: apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: { form_id?: string; answers?: Record<string, { name?: string; answer?: unknown }> } };
    if (body.content?.form_id !== formId || !body.content.answers) return null;
    return answersFromApi(body.content.answers);
  } catch (err) {
    console.error("JotForm webhook: no se pudo leer el envío por la API", err);
    return null;
  }
}

/** Parámetros de la URL (menos el token), para el GET del workflow o un POST que los mande ahí. */
function queryParams(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "token") out[key] = value;
  });
  return out;
}

/** Un objeto JSON plano → valores en texto (los anidados quedan como JSON). */
function flatten(json: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
}

/**
 * El cuerpo del POST, venga como venga: JSON, formulario (multipart o
 * urlencoded) o texto plano con JSON o `a=1&b=2` adentro (el "Body" del paso
 * Webhook del workflow de JotForm).
 */
async function readBody(request: NextRequest): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const out: Record<string, string> = {};
    form.forEach((value, key) => {
      if (typeof value === "string") out[key] = value;
    });
    return out;
  }
  const text = (await request.text()).trim();
  if (!text) return {};
  if (text.startsWith("{")) return flatten(JSON.parse(text) as Record<string, unknown>);
  return Object.fromEntries(new URLSearchParams(text));
}

/** El webhook del formulario y el del workflow no nombran igual los campos. */
const pick = (body: Record<string, string>, ...keys: string[]) => keys.map((k) => body[k]).find(Boolean) ?? "";

function intakeData(answers: AnswersByName) {
  const f = normalizeIntake(answers);
  return {
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
  };
}

function moneyData(answers: AnswersByName) {
  const f = normalizeMoneyRequest(answers);
  return {
    first_name: f.firstName,
    last_name: f.lastName,
    email: f.email,
    request_type: f.type,
    amount_cents: f.amountCents,
    deduct_cents: f.deductCents,
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = { ...queryParams(request), ...(await readBody(request)) };
  } catch {
    return Response.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  return handle(request, body);
}

export async function GET(request: NextRequest) {
  return handle(request, queryParams(request));
}

async function handle(request: NextRequest, body: Record<string, string>) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 401 });

  const formId = pick(body, "formID", "formId", "form_id");
  const workflowAnswers = formId === MONEY_FORM_ID ? answersFromWorkflowParams(body) : null;
  // El workflow puede no mandar el id del envío: sin él no se evita un
  // duplicado si avisa dos veces, pero la solicitud igual entra.
  const submissionId =
    pick(body, "submissionID", "submissionId", "submission_id", "id") || (workflowAnswers ? `wf-${Date.now()}` : "");
  // Otro formulario apuntando a este webhook: se ignora sin error, para que
  // JotForm no lo reintente.
  if (!FORMS.has(formId)) {
    console.warn("JotForm webhook: formulario no reconocido; campos recibidos:", Object.keys(body).join(", "));
    return Response.json({ ok: true, ignored: true });
  }
  // El botón TEST de JotForm manda los campos vacíos: se contesta 200 para
  // que deje guardar el paso, sin guardar nada.
  if (!submissionId) {
    console.warn("JotForm webhook: llamada sin datos (¿prueba?); campos recibidos:", Object.keys(body).join(", "));
    return Response.json({ ok: true, ignored: "no data" });
  }
  if (!/^(\d+|wf-\d+)$/.test(submissionId)) {
    console.error("JotForm webhook: submissionID inválido; campos recibidos:", Object.keys(body).join(", "));
    return Response.json({ ok: false, error: "bad submissionID" }, { status: 400 });
  }

  let answers = /^\d+$/.test(submissionId) ? await answersFromJotformApi(submissionId, formId) : null;
  if (!answers && body.rawRequest) {
    try {
      answers = answersFromRawRequest(JSON.parse(body.rawRequest) as Record<string, unknown>);
    } catch {
      return Response.json({ ok: false, error: "bad rawRequest" }, { status: 400 });
    }
  }
  answers ??= workflowAnswers;
  if (!answers) {
    console.error("JotForm webhook: sin datos del envío (falta JOTFORM_API_KEY o los parámetros); campos:", Object.keys(body).join(", "));
    return Response.json({ ok: false, error: "no submission data" }, { status: 400 });
  }
  // Una solicitud sin monto no es real (la prueba puede mandar los campos
  // con texto de ejemplo): no se guarda.
  if (formId === MONEY_FORM_ID && normalizeMoneyRequest(answers).amountCents === null) {
    console.warn("JotForm webhook: solicitud de dinero sin monto válido (¿prueba?); campos:", Object.keys(body).join(", "));
    return Response.json({ ok: true, ignored: "no amount" });
  }

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const common = { form_id: formId, submission_id: submissionId, submitted_at: new Date().toISOString(), raw: answers as Json };
  const { error } =
    formId === MONEY_FORM_ID
      ? await supabase.rpc("ingest_money_request", { p_token: token, p_data: { ...common, ...moneyData(answers) } })
      : await supabase.rpc("ingest_staff_intake", { p_token: token, p_data: { ...common, ...intakeData(answers) } });
  if (error) {
    const unauthorized = error.code === "42501" || error.message.includes("TOKEN_INVALIDO");
    if (!unauthorized) console.error("JotForm webhook: no se pudo guardar", error);
    return Response.json({ ok: false, error: unauthorized ? "invalid token" : "save failed" }, { status: unauthorized ? 401 : 500 });
  }
  return Response.json({ ok: true });
}
