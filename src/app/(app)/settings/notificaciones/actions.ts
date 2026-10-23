"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { saveNotificationSetting } from "@/services/notifications";

export async function saveNotificationSettingAction(key: string, input: { enabled: boolean; days: number[]; recipients: string[] | null }) {
  const me = await requireAdmin();
  try {
    await saveNotificationSetting(key, input, me.full_name || me.email);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error" };
  }
  revalidatePath("/settings/notificaciones");
  return { ok: true as const };
}
