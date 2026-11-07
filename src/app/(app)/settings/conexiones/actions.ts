"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { driveDiagnosis } from "@/lib/google/drive";
import { errText, recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";

type TestResult = { ok: boolean; message: string };

/** Prueba de solo lectura: ¿la clave de Jotform sirve? (una consulta a /user). */
export async function testJotformAction(): Promise<TestResult> {
  await requireAdmin();
  const key = process.env.JOTFORM_API_KEY?.trim();
  if (!key) return { ok: false, message: "Falta JOTFORM_API_KEY en Vercel." };
  const base = process.env.JOTFORM_API_URL ?? "https://api.jotform.com";
  let result: TestResult;
  try {
    const res = await fetch(`${base}/user?apiKey=${encodeURIComponent(key)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as { content?: { username?: string }; message?: string } | null;
    result = res.ok && body?.content
      ? { ok: true, message: `La clave funciona (cuenta ${body.content.username ?? "de Jotform"}).` }
      : { ok: false, message: `Jotform respondió ${res.status}${body?.message ? `: ${body.message}` : ""}` };
  } catch (err) {
    result = { ok: false, message: errText(err) };
  }
  await recordRun(await createClient(), null, "jotform:api", result.ok, result.message);
  return result;
}

/** Prueba de solo lectura: ¿Google acepta la llave y se llega a la carpeta raíz? */
export async function testDriveAction(): Promise<TestResult> {
  await requireAdmin();
  const d = await driveDiagnosis();
  if (!d.conectado) return { ok: false, message: "Drive no está conectado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_ROOT_FOLDER_ID en Vercel." };
  if (d.error) return { ok: false, message: String(d.error) };
  return { ok: true, message: `Funciona. Carpeta raíz: ${String(d.raiz).replace(/^OK: /, "")}` };
}
