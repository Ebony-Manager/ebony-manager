import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";

import type { Database } from "@/types/database";
import { VAPID_PUBLIC_KEY } from "./config";

function configure() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) throw new Error("Push no está configurado en el servidor.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@ebonycw.com", VAPID_PUBLIC_KEY, privateKey);
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  return createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sendPush(subscription: PushSubscription, payload: { title: string; body?: string | null; href?: string | null; tag?: string }) {
  configure();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

/** Envía los avisos internos pendientes a los dispositivos de administradores. */
export async function dispatchPendingPush(): Promise<number> {
  configure();
  const db = adminClient();
  const [{ data: notices, error: noticesError }, { data: admins, error: adminsError }] = await Promise.all([
    db.from("app_notifications").select("id,title,body,href").is("push_sent_at", null).order("created_at").limit(25),
    db.from("profiles").select("id").eq("role", "admin"),
  ]);
  if (noticesError) throw new Error(noticesError.message);
  if (adminsError) throw new Error(adminsError.message);
  if (!notices?.length) return 0;

  const adminIds = (admins ?? []).map((p) => p.id);
  if (!adminIds.length) return 0;
  const { data: subscriptions, error } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", adminIds);
  if (error) throw new Error(error.message);

  let sent = 0;
  for (const notice of notices) {
    for (const subscription of subscriptions ?? []) {
      try {
        await sendPush(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          { title: notice.title, body: notice.body, href: notice.href, tag: notice.id },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
    await db.from("app_notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", notice.id);
  }
  return sent;
}
