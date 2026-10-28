import { createClient as createAnonClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildSummaryEmail, type DailySummary } from "@/lib/almacen/daily-summary";
import type { Database } from "@/types/database";
import { dispatchPendingPush, ensureOverduePurchaseNotices } from "@/lib/notifications/push";

/**
 * Resumen diario del Almacén por correo (Resend).
 *
 * - El cron de Vercel (vercel.json) lo llama todos los días a las 7:00 de
 *   Panamá con `Authorization: Bearer CRON_SECRET`. Manda solo si en
 *   Settings → Notificaciones está prendido, si hoy es uno de los días
 *   elegidos y si hay algo que avisar.
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

  // El mismo cron diario crea los avisos de pedidos atrasados y despacha
  // cualquier push pendiente, aunque el correo del resumen esté apagado.
  if (isCron) {
    await ensureOverduePurchaseNotices().catch(() => undefined);
    await dispatchPendingPush().catch(() => undefined);
  }

  if (!isCron && url.searchParams.get("ver") === "1") {
    return new Response(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (!isCron && url.searchParams.get("enviar") !== "1") {
    return Response.json({ uso: "?activar=1 (una vez), ?ver=1 para ver el correo, ?enviar=1 para mandarlo ya", destinatarios: summary.recipients, asunto: email.subject });
  }
  if (isCron && !summary.enabled) return Response.json({ ok: true, enviado: false, motivo: "apagado en Settings → Notificaciones" });
  if (isCron && !summary.days.includes(summary.dow)) return Response.json({ ok: true, enviado: false, motivo: "hoy no es uno de los días elegidos" });
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
