"use server";

import { syncProjectOptions } from "@/lib/deliveries/acta-server";

import { requireAdmin } from "@/lib/auth/dal";
import { driveDiagnosis } from "@/lib/google/drive";
import { syncAllDriveNames } from "@/lib/google/drive-names";
import { errText, recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";
import {
  alegraAuthMode,
  alegraConfigured,
  alegraSupportReport,
  checkAccess,
  listItems,
  listTaxes,
  type AlegraOption,
} from "@/lib/alegra/api";
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
    const res = await fetch(`${base}/user?apiKey=${encodeURIComponent(key)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as {
      content?: { username?: string };
      message?: string;
    } | null;
    result =
      res.ok && body?.content
        ? {
            ok: true,
            message: `La clave funciona (cuenta ${body.content.username ?? "de Jotform"}).`,
          }
        : {
            ok: false,
            message: `Jotform respondió ${res.status}${body?.message ? `: ${body.message}` : ""}`,
          };
  } catch (err) {
    result = { ok: false, message: errText(err) };
  }
  await recordRun(
    await createClient(),
    null,
    "jotform:api",
    result.ok,
    result.message,
  );
  // Con la clave buena, pone al día la lista de proyectos de los formularios (acta, pintura, embalaje).
  if (result.ok) {
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("name").eq("status", "ACTIVE");
    const n = await syncProjectOptions((data ?? []).map((p) => p.name)).catch(() => 0);
    if (n > 0) result = { ...result, message: `${result.message} Lista de proyectos actualizada en ${n} formulario${n === 1 ? "" : "s"}.` };
  }
  return result;
}

/** Prueba de solo lectura: ¿Google acepta la llave y se llega a la carpeta raíz? */
export async function testDriveAction(): Promise<TestResult> {
  await requireAdmin();
  const d = await driveDiagnosis();
  if (!d.conectado)
    return {
      ok: false,
      message:
        "Drive no está conectado: faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_DRIVE_ROOT_FOLDER_ID en Vercel.",
    };
  if (d.error) return { ok: false, message: String(d.error) };
  return {
    ok: true,
    message: `Funciona. Carpeta raíz: ${String(d.raiz).replace(/^OK: /, "")}`,
  };
}

/**
 * Renombra las carpetas de Drive (proyectos y oportunidades) para que se llamen igual que en la aplicación.
 * Solo cambia nombres: los enlaces y lo que hay dentro no se tocan. Se detiene si Drive no da permiso.
 */
export async function syncDriveNamesAction(): Promise<TestResult> {
  await requireAdmin();
  try {
    const r = await syncAllDriveNames(await createClient());
    const parts = [`${r.renamed.length} renombradas`, `${r.unchanged} ya estaban bien`];
    if (r.errors.length) parts.push(`${r.errors.length} con error: ${r.errors.slice(0, 2).join(" · ")}`);
    return { ok: r.errors.length === 0, message: parts.join(" · ") };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Error" };
  }
}

/** Informe completo (consulta + respuesta, sin la clave) para mandarle al soporte de Alegra. Solo lectura. */
export async function alegraSupportReportAction(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!alegraConfigured()) return { ok: false, error: "Faltan ALEGRA_EMAIL y ALEGRA_TOKEN (o ALEGRA_JWT) en Vercel." };
  try {
    return { ok: true, text: await alegraSupportReport() };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/** Prueba de solo lectura: ¿Alegra acepta el correo y el token? */
export async function testAlegraAction(): Promise<TestResult> {
  await requireAdmin();
  if (!alegraConfigured())
    return {
      ok: false,
      message: "Faltan ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel.",
    };
  let result: TestResult;
  try {
    const checks = await checkAccess();
    const bad = checks.filter((c) => !c.ok);
    const how =
      alegraAuthMode() === "jwt" ? "con el JWT Token" : "con correo + token";
    if (bad.length === 0)
      result = {
        ok: true,
        message: `Funciona (${how}): la app puede leer facturas, productos y servicios, impuestos, contactos, cotizaciones y numeraciones.`,
      };
    else if (bad.every((c) => c.error?.startsWith("Alegra 401")))
      result = {
        ok: false,
        message:
          "Alegra no acepta el correo o el token (401): revisa ALEGRA_EMAIL y ALEGRA_TOKEN en Vercel.",
      };
    else
      result = {
        ok: false,
        message: `(${how}) ${bad.map((c) => `${c.name}: ${c.error}`).join(" · ")}${
          checks.some((c) => c.ok)
            ? ` (sí funcionan: ${checks
                .filter((c) => c.ok)
                .map((c) => c.name)
                .join(", ")})`
            : ""
        }`,
      };
  } catch (err) {
    result = { ok: false, message: errText(err) };
  }
  await recordRun(
    await createClient(),
    null,
    "alegra:api",
    result.ok,
    result.message,
  );
  return result;
}

/** Los productos/servicios y los impuestos de Alegra, para elegir (solo lectura). */
export async function getAlegraOptionsAction(): Promise<
  | { ok: true; items: AlegraOption[]; taxes: AlegraOption[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  try {
    const [items, taxes] = await Promise.all([listItems(), listTaxes()]);
    return { ok: true, items, taxes };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

export async function saveAlegraConfigAction(
  config: AlegraConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!config.itemId)
    return { ok: false, error: "Elige el producto o servicio." };
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
