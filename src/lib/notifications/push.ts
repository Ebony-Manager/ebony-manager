import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";

import type { Database } from "@/types/database";
import { VAPID_PUBLIC_KEY } from "./config";
import { notificationTitle } from "./presentation";

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

/** Crea una sola alerta por pedido que siga abierto después de siete días. */
export async function ensureOverduePurchaseNotices(): Promise<number> {
  const db = adminClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: orders, error } = await db.from("purchase_orders").select("id,supplier_id,ordered_on").in("status", ["pedido", "parcial"]).lt("ordered_on", cutoff);
  if (error) throw new Error(error.message);
  if (!orders?.length) return 0;
  const supplierIds = [...new Set(orders.map((order) => order.supplier_id))];
  const { data: suppliers } = await db.from("suppliers").select("id,name").in("id", supplierIds);
  const supplierName = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.name]));
  const { data, error: insertError } = await db.from("app_notifications").upsert(
    orders.map((order) => ({
      kind: "purchasing_overdue",
      type_key: "purchasing_overdue",
      title: "Pedido atrasado",
      body: `${supplierName.get(order.supplier_id) ?? "Proveedor"} · Pedido del ${order.ordered_on}`,
      href: "/almacen/compras",
      dedupe_key: `purchasing_overdue:${order.id}`,
    })),
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  ).select("id");
  if (insertError) throw new Error(insertError.message);
  return data?.length ?? 0;
}

export async function sendPush(subscription: PushSubscription, payload: { title: string; body?: string | null; href?: string | null; tag?: string }) {
  configure();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

/** Envía cada aviso a sus destinatarios cuando el admin habilitó ese tipo de push. */
export async function dispatchPendingPush(): Promise<number> {
  configure();
  const db = adminClient();
  const [{ data: recipients, error: recipientError }, { data: types, error: typesError }, { data: preferences, error: preferencesError }] = await Promise.all([
    db.from("app_notification_recipients").select("notification_id,user_id").is("push_sent_at", null).limit(100),
    db.from("notification_types").select("key,default_push"),
    db.from("user_notification_preferences").select("user_id,type_key,push_enabled"),
  ]);
  if (recipientError) throw new Error(recipientError.message);
  if (typesError) throw new Error(typesError.message);
  if (preferencesError) throw new Error(preferencesError.message);
  if (!recipients?.length) return 0;
  const noticeIds = [...new Set(recipients.map((r) => r.notification_id))];
  const userIds = [...new Set(recipients.map((r) => r.user_id))];
  const [{ data: notices, error: noticesError }, { data: subscriptions, error }] = await Promise.all([
    db.from("app_notifications").select("id,type_key,title,body,href").in("id", noticeIds),
    db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", userIds),
  ]);
  if (noticesError) throw new Error(noticesError.message);
  if (error) throw new Error(error.message);
  const noticeById = new Map((notices ?? []).map((n) => [n.id, n]));
  const defaultByType = new Map((types ?? []).map((t) => [t.key, t.default_push]));
  const preference = new Map((preferences ?? []).map((p) => [`${p.user_id}:${p.type_key}`, p.push_enabled]));
  const subsByUser = new Map<string, NonNullable<typeof subscriptions>>();
  for (const sub of subscriptions ?? []) subsByUser.set(sub.user_id, [...(subsByUser.get(sub.user_id) ?? []), sub]);

  let sent = 0;
  for (const recipient of recipients) {
    const notice = noticeById.get(recipient.notification_id);
    if (!notice) continue;
    const enabled = notice.type_key ? (preference.get(`${recipient.user_id}:${notice.type_key}`) ?? defaultByType.get(notice.type_key) ?? false) : false;
    if (enabled) for (const subscription of subsByUser.get(recipient.user_id) ?? []) {
      try {
        await sendPush(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          { title: notificationTitle(notice.type_key, notice.title), body: notice.body, href: notice.href, tag: notice.id },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
    await db.from("app_notification_recipients").update({ push_sent_at: new Date().toISOString() }).eq("notification_id", recipient.notification_id).eq("user_id", recipient.user_id);
  }
  return sent;
}
