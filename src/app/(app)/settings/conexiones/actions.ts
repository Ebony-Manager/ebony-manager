"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { driveDiagnosis } from "@/lib/google/drive";
import { errText, recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";
import { alegraConfigured, checkAccess, listItems, listTaxes, type AlegraOption } from "@/lib/alegra/api";
import type { AlegraConfig } from "@/lib/alegra/invoice";
import { saveDocumentSetting } from "@/services/settings";
import { revalidatePath } from "next/cache";

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

/** Prueba de solo lectura: ¿Alegra acepta el correo y el token? */
export async function testAlegraAction(): Promise<TestResult> {
  await requireAdmin();
  if (!alegraConfigured()) return { ok: false, message: "Faltan ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel." };
  let result: TestResult;
  try {
    const checks = await checkAccess();
    const bad = checks.filter((c) => !c.ok);
    if (bad.length === 0) result = { ok: true, message: "Funciona: la app puede leer facturas, productos y servicios, impuestos y contactos." };
    else if (bad.every((c) => c.error?.startsWith("Alegra 401")))
      result = { ok: false, message: "Alegra no acepta el correo o el token (401): revisa ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel." };
    else
      result = {
        ok: false,
        message: `${bad.map((c) => `${c.name}: ${c.error}`).join(" · ")}${checks.some((c) => c.ok) ? ` (sí funcionan: ${checks.filter((c) => c.ok).map((c) => c.name).join(", ")})` : ""}`,
      };
  } catch (err) {
    result = { ok: false, message: errText(err) };
  }
  await recordRun(await createClient(), null, "alegra:api", result.ok, result.message);
  return result;
}

/** Los productos/servicios y los impuestos de Alegra, para elegir (solo lectura). */
export async function getAlegraOptionsAction(): Promise<{ ok: true; items: AlegraOption[]; taxes: AlegraOption[] } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const [items, taxes] = await Promise.all([listItems(), listTaxes()]);
    return { ok: true, items, taxes };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

export async function saveAlegraConfigAction(config: AlegraConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!config.itemId) return { ok: false, error: "Elige el producto o servicio." };
  try {
    await saveDocumentSetting("alegra", {
      itemId: String(config.itemId),
      itemName: config.itemName,
      taxId: config.taxId ? String(config.taxId) : null,
      taxName: config.taxName,
      taxPct: typeof config.taxPct === "number" ? config.taxPct : null,
    });
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  revalidatePath("/settings/conexiones");
  return { ok: true };
}
