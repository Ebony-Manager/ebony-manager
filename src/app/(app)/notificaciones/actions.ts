"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { markNoticeSeen, markNoticesSeen } from "@/services/notifications";

export async function markAllNotificationsReadAction() {
  await requireProfile();
  await markNoticesSeen();
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(id: string) {
  await requireProfile();
  await markNoticeSeen(id, true);
  revalidatePath("/", "layout");
}
