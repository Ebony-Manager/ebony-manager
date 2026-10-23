import { createClient as createAnonClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildSummaryEmail, type DailySummary } from "@/lib/almacen/daily-summary";
import type { Database } from "@/types/database";

/**
 * Resumen diario del Almacén por correo (Resend).
 *
 * - El cron de Vercel lo llama cada mañana con `Authorization: Bearer
 *   CRON_SECRET` y se manda solo si hay algo que avisar. PAUSADO hasta que se
 *   empiece a usar el inventario: para reactivarlo, en vercel.json
 *   `"crons": [{ "path": "/api/almacen/resumen-diario", "schedule": "0 12 * * 1-6" }]`
 *   (lunes a sábado, 7:00 de Panamá).
 * - Un admin con sesión puede: `?activar=1` (una vez: guarda el hash del
 *   CRON_SECRET en la base, sin copiarlo a mano), `?ver=1` (ver el correo en
 *   el navegador) y `?enviar=1` (mandarlo ya, para probar).
 *
 * Variables en Vercel: CRON_SECRET, RESEND_API_KEY y RESEND_FROM
 * (ej. "Ebony Manager <almacen@tudominio.com>", de un dominio verificado en Resend).
 */
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const url = new URL(request.url);
  const isCron = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;

  if (!isCron) {
    await requireAdmin();
    if (!secret) return new Response("Falta CRON_SECRET en Vercel.", { status: 500 });
    if (url.searchParams.get("activar") === "1") {
      const { error } = await (await createClient()).rpc("set_inventory_summary_token", { p_token: secret });
      if (error) return new Response(error.message, { status: 500 });
      return new Response("Resumen diario activado. Ya puedes probarlo con ?ver=1 o ?enviar=1.");
    }
  }

  const anon = createAnonClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await anon.rpc("inventory_daily_summary", { p_token: secret! });
  if (error) {
    const hint = error.message.includes("TOKEN_INVALIDO") ? " Falta activarlo: abre esta dirección con ?activar=1 (admin)." : "";
    return new Response(`No se pudo leer el resumen: ${error.message}.${hint}`, { status: 500 });
  }
  const summary = data as unknown as DailySummary;
  const email = buildSummaryEmail(summary, url.origin);

  if (!isCron && url.searchParams.get("ver") === "1") {
    return new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (!isCron && url.searchParams.get("enviar") !== "1") {
    return Response.json({ uso: "?activar=1 (una vez), ?ver=1 para ver el correo, ?enviar=1 para mandarlo ya", destinatarios: summary.recipients, asunto: email.subject });
  }
  if (isCron && !email.hasContent) return Response.json({ ok: true, enviado: false, motivo: "nada que avisar" });
  if (summary.recipients.length === 0) return Response.json({ ok: true, enviado: false, motivo: "sin destinatarios" });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return new Response("Faltan RESEND_API_KEY o RESEND_FROM en Vercel.", { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: summary.recipients, subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) return new Response(`Resend respondió ${res.status}: ${await res.text()}`, { status: 502 });
  return Response.json({ ok: true, enviado: true, destinatarios: summary.recipients, asunto: email.subject });
}
