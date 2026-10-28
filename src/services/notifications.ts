import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Un aviso automático de la app (Settings → Notificaciones). Solo admin (RLS). */
export interface NotificationSetting {
  key: string;
  enabled: boolean;
  /** Días ISO: 1 = lunes … 7 = domingo. */
  days: number[];
  /** Correos elegidos; null = automático. */
  recipients: string[] | null;
  updatedAt: string;
  updatedByName: string | null;
}

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_settings").select("*").order("key");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    key: r.key,
    enabled: r.enabled,
    days: r.days,
    recipients: r.recipients,
    updatedAt: r.updated_at,
    updatedByName: r.updated_by_name,
  }));
}

export async function saveNotificationSetting(
  key: string,
  input: { enabled: boolean; days: number[]; recipients: string[] | null },
  byName: string | null,
): Promise<void> {
  const supabase = await createClient();
  const days = [...new Set(input.days.filter((d) => d >= 1 && d <= 7))].sort();
  const recipients = input.recipients ? [...new Set(input.recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))] : null;
  const { error } = await supabase
    .from("notification_settings")
    .update({ enabled: input.enabled, days, recipients, updated_by_name: byName })
    .eq("key", key);
  if (error) throw new Error(error.message);
}

/** Un aviso de la app para los admin (ej. alguien ajustó la asistencia). */
export interface AppNotice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  createdAt: string;
  seenAt: string | null;
  typeKey: string | null;
  module: string | null;
}

export async function getNotices(limit = 50): Promise<AppNotice[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: recipients, error: recipientsError }] = await Promise.all([
    supabase.from("app_notifications").select("*").order("created_at", { ascending: false }).limit(limit),
    supabase.from("app_notification_recipients").select("notification_id,read_at"),
  ]);
  if (error) throw new Error(error.message);
  if (recipientsError) throw new Error(recipientsError.message);
  const readAt = new Map((recipients ?? []).map((r) => [r.notification_id, r.read_at]));
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    actorName: r.actor_name,
    createdAt: r.created_at,
    seenAt: readAt.get(r.id) ?? null,
    typeKey: r.type_key,
    module: r.module,
  }));
}

/** Cuántos avisos no ha visto el admin actual (el número rojo del menú). */
export async function getUnseenNoticeCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("app_notification_recipients").select("notification_id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNoticesSeen(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_notification_recipients").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw new Error(error.message);
}

export async function markNoticeSeen(id: string, seen: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_notification_recipients").update({ read_at: seen ? new Date().toISOString() : null }).eq("notification_id", id);
  if (error) throw new Error(error.message);
}

export interface NotificationType {
  key: string;
  module: string;
  title: string;
  description: string;
  defaultPush: boolean;
  sortOrder: number;
}

export interface UserPushPreference {
  userId: string;
  typeKey: string;
  pushEnabled: boolean;
}

export async function getNotificationTypes(): Promise<NotificationType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_types").select("*").eq("active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ key: r.key, module: r.module, title: r.title, description: r.description, defaultPush: r.default_push, sortOrder: r.sort_order }));
}

export async function getAllPushPreferences(): Promise<{ preferences: UserPushPreference[]; devices: Record<string, number> }> {
  const supabase = await createClient();
  const [{ data, error }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    supabase.from("user_notification_preferences").select("user_id,type_key,push_enabled"),
    supabase.from("push_subscriptions").select("user_id"),
  ]);
  if (error) throw new Error(error.message);
  if (subscriptionError) throw new Error(subscriptionError.message);
  const devices: Record<string, number> = {};
  for (const row of subscriptions ?? []) devices[row.user_id] = (devices[row.user_id] ?? 0) + 1;
  return { preferences: (data ?? []).map((r) => ({ userId: r.user_id, typeKey: r.type_key, pushEnabled: r.push_enabled })), devices };
}

export async function saveUserPushPreferences(userId: string, values: Record<string, boolean>, updatedBy: string): Promise<void> {
  const supabase = await createClient();
  const rows = Object.entries(values).map(([type_key, push_enabled]) => ({ user_id: userId, type_key, push_enabled, updated_by: updatedBy }));
  if (!rows.length) return;
  const { error } = await supabase.from("user_notification_preferences").upsert(rows, { onConflict: "user_id,type_key" });
  if (error) throw new Error(error.message);
}
