"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { hasModule, isAppModule } from "@/lib/auth/modules";
import { getNotificationTypes, saveMyPushPreferences } from "@/services/notifications";

export async function saveMyPushPreferencesAction(values: Record<string, boolean>) {
  const profile = await requireProfile();
  try {
    const types = await getNotificationTypes();
    const allowed = new Set(types.filter((type) => isAppModule(type.module) && hasModule(profile, type.module)).map((type) => type.key));
    await saveMyPushPreferences(profile.id, Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key))));
    revalidatePath("/perfil/notificaciones");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Error" };
  }
}
