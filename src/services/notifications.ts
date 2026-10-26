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
}

export async function getNotices(limit = 50): Promise<AppNotice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    actorName: r.actor_name,
    createdAt: r.created_at,
    seenAt: r.seen_at,
  }));
}

/** Cuántos avisos no ha visto ningún admin (el número rojo del menú). */
export async function getUnseenNoticeCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("app_notifications").select("id", { count: "exact", head: true }).is("seen_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNoticesSeen(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_notifications").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
  if (error) throw new Error(error.message);
}
